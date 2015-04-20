// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/node.d.ts"/>

import cfgm = require('./configuration');
import cm = require('./common');
import ctxm = require('./context');
import dm = require('./diagnostics');
import ifm = require('./api/interfaces');
import jrm = require("./job");
import fm = require('./feedback');
import os = require('os');
import tm = require('./tracing');
import path = require('path');
import crypto = require('crypto');

var wk: ctxm.WorkerContext;
var trace: tm.Tracing;

function setVariables(job: ifm.JobRequestMessage, workerContext: ctxm.WorkerContext) {
    trace.enter('setVariables');
    trace.state('variables', job.environment.variables);

    var workingFolder = workerContext.workFolder;
    var variables = job.environment.variables;

    var sys = variables[cm.sysVars.system];
    var collId = variables[cm.sysVars.collectionId];
    var defId = variables[cm.sysVars.definitionId];
    var hashInput = collId + ':' + defId;

    if (job.environment.endpoints) {
        job.environment.endpoints.forEach(function (endpoint) {
            hashInput = hashInput + ':' + endpoint.url;
        });
    }

    // TODO: build dir should be defined in the build plugin - not in core agent
    var hashProvider = crypto.createHash("sha256");
    hashProvider.update(hashInput, 'utf8');
    var hash = hashProvider.digest('hex');
    var buildDirectory = path.join(workingFolder, sys, hash);
    variables[cm.agentVars.workingDirectory] = workingFolder;
    variables[cm.agentVars.buildDirectory] = buildDirectory;

    var stagingFolder = path.join(buildDirectory, 'staging');
    job.environment.variables[cm.buildVars.stagingDirectory] = stagingFolder;

    trace.state('variables', job.environment.variables);
}

function deserializeEnumValues(job: ifm.JobRequestMessage) {
    if (job && job.environment && job.environment.mask) {
        job.environment.mask.forEach((maskHint: ifm.MaskHint, index: number) => {
            maskHint.type = ifm.TypeInfo.MaskType.enumValues[maskHint.type];
        });
    }
}

//
// Worker process waits for a job message, processes and then exits
//
export function run(msg, consoleOutput: boolean, 
                    createFeedbackChannel: (agentUrl, taskUrl, jobInfo, ag) => cm.IFeedbackChannel, 
                    finished: () => void) {

    wk = new ctxm.WorkerContext(msg.config, true);
    trace = new tm.Tracing(__filename, wk);
    trace.enter('.onMessage');
    trace.state('message', msg);

    wk.info('worker::onMessage');
    if (msg.messageType === "job") {
        var job: ifm.JobRequestMessage = msg.data;
        deserializeEnumValues(job);
        setVariables(job, wk);

        var jobInfo: cm.IJobInfo = cm.jobInfoFromJob(job);

        // TODO: on output from context --> diag
        // TODO: these should be set beforePrepare and cleared postPrepare after we add agent ext
        if (msg.config && msg.config.creds) {
            process.env['altusername'] = msg.config.creds.username;
            process.env['altpassword'] = msg.config.creds.password;
        }

        wk.status('Running job: ' + job.jobName);
        wk.info('message:');
        trace.state('msg:', msg);

        var agentUrl = wk.config.settings.serverUrl;

        // backcompat with old server
        var taskUrl = job.environment.systemConnection ? job.environment.systemConnection.url : job.authorization.serverUrl;        

        var serviceChannel: cm.IFeedbackChannel = createFeedbackChannel(agentUrl, taskUrl, jobInfo, wk);
        wk.service = serviceChannel;

        var ctx: ctxm.JobContext = new ctxm.JobContext(job, wk.service, wk);
        trace.write('created JobContext');

        var jobRunner: jrm.JobRunner = new jrm.JobRunner(wk, ctx);
        trace.write('created jobRunner');

        jobRunner.run((err: any, result: ifm.TaskResult) => {
            trace.callback('job.run');

            wk.status('Job Completed: ' + job.jobName);
            if (err) {
                wk.error('Error: ' + err.message);
            }

            ctx.finishJob(result, (err: any) => {
                trace.callback('ctx.finishJob');
 
                wk.status('Job Finished: ' + job.jobName);
                if (err) {
                    wk.error('Error: ' + err.message);
                }

                finished();
            });
        });
    }
}

process.on('message', function (msg) {
    run(msg, true,
        function (agentUrl, taskUrl, jobInfo, ag) {
            return new fm.ServiceChannel(agentUrl, taskUrl, jobInfo, ag);
        },
        function () {
            process.exit();
        });
});

process.on('uncaughtException', function (err) {
    console.error('unhandled:' + err.message);

    if (wk) {
        wk.error('worker unhandled: ' + err.message);
        wk.error(err);
    }

    process.exit();
});

process.on('SIGINT', function () {
    if (wk) {
        wk.info("\nShutting down agent.");
    }

    process.exit();
})
