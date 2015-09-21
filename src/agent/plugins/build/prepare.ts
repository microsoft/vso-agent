// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

//import shell = require('shelljs');
import path = require('path');
import fs = require('fs');
var url = require('url');
import async = require('async');
import ctxm = require('../../context');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import gitrepo = require('./lib/gitrepo');
import Q = require('q');
import shell = require('shelljs');
import crypto = require('crypto');
import cm = require('../../common');
import smm = require('./sourceManager');

// keep lower case, we do a lower case compare
var supported: string[] = ['tfsgit', 'git', 'github', 'tfsversioncontrol'];

export function pluginName() {
    return "prepareWorkspace";
}

// what shows in progress view
export function pluginTitle() {
    return "Preparing Workspace"
}

export function beforeJob(executionContext: cm.IExecutionContext, callback) {
    executionContext.info('preparing Workspace');
    executionContext.info('cwd: ' + process.cwd());

    var job: agentifm.JobRequestMessage = executionContext.jobInfo.jobMessage;

    //------------------------------------------------------------
    // Get Code from Repos
    //------------------------------------------------------------

    var endpoints: agentifm.ServiceEndpoint[] = job.environment.endpoints;

    var variables = job.environment.variables;    

    var srcendpoints = endpoints.filter(function (endpoint: agentifm.ServiceEndpoint) {
        if (!endpoint.type) {
            return false;
        }
        return (supported.indexOf(endpoint.type.toLowerCase()) >= 0);
    });

    if (srcendpoints.length == 0) {
        callback(new Error('No valid repository type'));
        return;
    }

    // only support 1
    var endpoint: agentifm.ServiceEndpoint = endpoints[0];

    var srcMgr: smm.SourceManager = new smm.SourceManager(variables[cm.agentVars.workingDirectory]);
    var buildDirectory: string = srcMgr.ensureDirectory(job);
    executionContext.info('using build directory: ' + buildDirectory);

    job.environment.variables['agent.buildDirectory'] = buildDirectory;
    shell.mkdir('-p', buildDirectory);
    shell.cd(buildDirectory);

    var repoPath = path.resolve('repo');
    job.environment.variables['build.sourceDirectory'] = repoPath;
    job.environment.variables['build.stagingdirectory'] = path.resolve("staging");

    // TODO: remove compat variable
    job.environment.variables['sys.sourcesFolder'] = repoPath;

    var scmm;
    var providerType = endpoint.type.toLowerCase();
    executionContext.info('using source provider: ' + providerType);

    try {
        var provPath = path.join(executionContext.scmPath, providerType);
        executionContext.info('loading: ' + provPath);
        scmm = require(provPath);    
    }
    catch(err) {
        callback(new Error('Source Provider not found: ' + providerType));
        return;        
    }
    
    var scmProvider: cm.IScmProvider = scmm.getProvider(executionContext, repoPath);
    scmProvider.hash = hash;
    scmProvider.initialize(endpoint);
    scmProvider.debugOutput = executionContext.debugOutput;

    return Q(null)
    .then(() => {
        if (endpoint.data['clean'] === "true") {
            var behavior = job.environment.variables['build.clean'];
            if (behavior && behavior.toLowerCase() === 'delete') {
                executionContext.info('deleting ' + repoPath);
                shell.rm('-rf', repoPath);
                return 0;
            }
            else {
                executionContext.info('running clean');
                return scmProvider.clean();                
            }
        }
        else {
            return 0;
        }
    })
    .then((code: number) => {
        executionContext.info('getting code');
        return scmProvider.getCode();
    })
    .then((code: number) => {
        callback();
    })    
    .fail((err) => {
        callback(err);
        return;
    })

}
