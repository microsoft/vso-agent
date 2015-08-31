// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/node.d.ts"/>

import cfgm = require('./configuration');
import cm = require('./common');
import ctxm = require('./context');
import dm = require('./diagnostics');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import jrm = require('./job');
import fm = require('./feedback');
import os = require('os');
import tm = require('./tracing');
import path = require('path');
import crypto = require('crypto');
import wapim = require('./api/webapi');
import Q = require('q');

var hostContext: ctxm.HostContext;
var trace: tm.Tracing;

function setVariables(job: agentifm.JobRequestMessage, config: cm.IConfiguration) {
    trace.enter('setVariables');
    trace.state('variables', job.environment.variables);

    var workingFolder = cm.getWorkPath(config);
    var variables = job.environment.variables;

    if (!variables[cm.sysVars.collectionUri]) {
        variables[cm.sysVars.collectionUri] =  job.environment.systemConnection.url;     
    }

    variables[cm.agentVars.workingDirectory] = workingFolder;

    var stagingFolder = path.join(workingFolder, 'staging');
    job.environment.variables[cm.buildVars.stagingDirectory] = stagingFolder;

    trace.state('variables', job.environment.variables);
}

function deserializeEnumValues(job: agentifm.JobRequestMessage) {
    if (job && job.environment && job.environment.mask) {
        job.environment.mask.forEach((maskHint: agentifm.MaskHint, index: number) => {
            maskHint.type = agentifm.TypeInfo.MaskType.enumValues[maskHint.type];
        });
    }
}

function getWorkerDiagnosticWriter(config: cm.IConfiguration): cm.IDiagnosticWriter {
    if (config.createDiagnosticWriter) {
        return config.createDiagnosticWriter();
    }
    
    var diagFolder = cm.getWorkerDiagPath(config);
    
    return dm.getDefaultDiagnosticWriter(config, diagFolder, 'worker');
}

//
// Worker process waits for a job message, processes and then exits
//
export function run(msg: cm.IWorkerMessage, consoleOutput: boolean, 
                    createFeedbackChannel: (agentUrl, taskUrl, jobInfo, ag) => cm.IFeedbackChannel): Q.Promise<any> {
    var deferred = Q.defer();
    var config: cm.IConfiguration = msg.config;
    
    hostContext = new ctxm.HostContext(config, getWorkerDiagnosticWriter(config), true);
    trace = new tm.Tracing(__filename, hostContext);
    trace.enter('.onMessage');
    trace.state('message', msg);

    hostContext.info('worker::onMessage');
    if (msg.messageType === cm.WorkerMessageTypes.Abandoned) {
        hostContext.emit(fm.Events.Abandoned);
    }
    else if (msg.messageType === cm.WorkerMessageTypes.Job) {
        var job: agentifm.JobRequestMessage = msg.data;
        deserializeEnumValues(job);
        setVariables(job, config);

        trace.write('Creating AuthHandler');
        var systemAuthHandler: baseifm.IRequestHandler;
        if (job.environment.systemConnection) {
            trace.write('using session token');
            var accessToken = job.environment.systemConnection.authorization.parameters['AccessToken'];
            trace.state('AccessToken:', accessToken);
            systemAuthHandler = wapim.bearerHandler(accessToken);
        }
        else {
            trace.write('using altcreds');
            hostContext.error('system connection token not supplied.  unsupported deployment.')
        }

        // TODO: jobInfo should go away and we should just have JobContext
        var jobInfo: cm.IJobInfo = cm.jobInfoFromJob(job, systemAuthHandler);

        // TODO: on output from context --> diag
        // TODO: these should be set beforePrepare and cleared postPrepare after we add agent ext
        if (msg.config && (<any>msg.config).creds) {
            var altCreds = (<any>msg.config).creds;
            process.env['altusername'] = altCreds.username;
            process.env['altpassword'] = altCreds.password;
        }

        hostContext.status('Running job: ' + job.jobName);
        hostContext.info('message:');
        trace.state('msg:', msg);

        var agentUrl = hostContext.config.settings.serverUrl;
        var taskUrl = job.environment.variables[cm.sysVars.collectionUri]

        var serviceChannel: cm.IFeedbackChannel = createFeedbackChannel(agentUrl, taskUrl, jobInfo, hostContext);

        var ctx: ctxm.JobContext = new ctxm.JobContext(job, systemAuthHandler, serviceChannel, hostContext);
        trace.write('created JobContext');

        var jobRunner: jrm.JobRunner = new jrm.JobRunner(hostContext, ctx);
        trace.write('created jobRunner');

        // guard to ensure we only "finish" once 
        var finishingJob: boolean = false;
        
        hostContext.on(fm.Events.Abandoned, () => {
            // if finishingJob is true here, then the jobRunner finished
            // ctx.finishJob will take care of draining the service channel
            if (!finishingJob) {
                finishingJob = true;
                hostContext.error("Job abandoned by the server.");
                // nothing much to do if drain rejects...
                serviceChannel.drain().fin(() => {
                    trace.write("Service channel drained");
                    deferred.resolve(null);
                });
            }
        });

        jobRunner.run((err: any, result: agentifm.TaskResult) => {
            trace.callback('job.run');

            hostContext.status('Job Completed: ' + job.jobName);
            if (err) {
                hostContext.error('Error: ' + err.message);
            }

            // if finishingJob is true here, then the lock renewer got a 404, which means the server abandoned the job
            // it's already calling serviceChannel.drain() and it's going to call finished()
            if (!finishingJob) {
                finishingJob = true;
                ctx.finishJob(result).fin(() => {
                    // trace and status no matter what. if finishJob failed, the fail handler below will be called
                    trace.callback('ctx.finishJob');
                    hostContext.status('Job Finished: ' + job.jobName);
                }).fail((err: any) => {
                    if (err) {
                        hostContext.error('Error: ' + err.message);
                    }
                }).fin(() => {
                    deferred.resolve(null);
                });
            }
        });
    }
    else {
        // don't know what to do with this message
        deferred.resolve(null);
    }
    
    return deferred.promise;
}

process.on('message', function (msg: cm.IWorkerMessage) {
    run(msg, true,
        function (agentUrl, taskUrl, jobInfo, ag) {
            return new fm.ServiceChannel(agentUrl, taskUrl, jobInfo, ag);
        }).fin(() => {
            process.exit();
        });
});

process.on('uncaughtException', function (err) {
    console.error('unhandled:' + err.message);
    console.error(err.stack);

    if (hostContext) {
        hostContext.error('worker unhandled: ' + err.message);
        hostContext.error(err.stack);
    }

    process.exit();
});

process.on('SIGINT', function () {
    if (hostContext) {
        hostContext.info("\nShutting down agent.");
    }

    process.exit();
})
