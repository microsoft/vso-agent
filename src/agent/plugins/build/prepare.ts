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

// keep lower case, we do a lower case compare
var supported: string[] = ['tfsgit', 'git', 'github', 'tfsversioncontrol'];

export function pluginName() {
    return "prepareWorkspace";
}

// what shows in progress view
export function pluginTitle() {
    return "Preparing Workspace"
}

export function beforeJob(ctx: ctxm.JobContext, callback) {
    ctx.info('preparing Workspace');
    ctx.info('cwd: ' + process.cwd());

    var job: agentifm.JobRequestMessage = ctx.jobInfo.jobMessage;

    //------------------------------------------------------------
    // Get Code from Repos
    //------------------------------------------------------------

    var endpoints: agentifm.ServiceEndpoint[] = ctx.job.environment.endpoints;

    var variables = ctx.job.environment.variables;    

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

    var sys = variables[cm.sysVars.system];
    var collId = variables[cm.sysVars.collectionId];

    var defId = variables[cm.sysVars.definitionId];
    var hashInput = collId + ':' + defId;

    //
    // Get the repo path under the working directory
    //
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
    var workingFolder = variables[cm.agentVars.workingDirectory];
    var buildDirectory = path.join(workingFolder, sys, hash);
    ctx.info('using build directory: ' + buildDirectory);

    ctx.job.environment.variables['agent.buildDirectory'] = buildDirectory;
    shell.mkdir('-p', buildDirectory);
    shell.cd(buildDirectory);

    var repoPath = path.resolve('repo');
    ctx.job.environment.variables['build.sourceDirectory'] = repoPath;
    ctx.job.environment.variables['build.stagingdirectory'] = path.resolve("staging");

    // TODO: remove compat variable
    ctx.job.environment.variables['sys.sourcesFolder'] = repoPath;

    var scmm;
    var providerType = endpoint.type.toLowerCase();
    ctx.info('using source provider: ' + providerType);

    try {
        var provPath = path.join(ctx.scmPath, providerType);
        ctx.info('loading: ' + provPath);
        scmm = require(provPath);    
    }
    catch(err) {
        callback(new Error('Source Provider not found: ' + providerType));
        return;        
    }
    
    var scmProvider: cm.IScmProvider = scmm.getProvider(ctx, repoPath);
    scmProvider.hash = hash;
    scmProvider.initialize(endpoint);
    scmProvider.debugOutput = ctx.debugOutput;

    return Q(null)
    .then(() => {
        if (endpoint.data['clean'] === "true") {
            var behavior = ctx.job.environment.variables['build.clean'];
            if (behavior && behavior.toLowerCase() === 'delete') {
                ctx.info('deleting ' + repoPath);
                shell.rm('-rf', repoPath);
                return 0;
            }
            else {
                ctx.info('running clean');
                return scmProvider.clean();                
            }
        }
        else {
            return 0;
        }
    })
    .then((code: number) => {
        ctx.info('getting code');
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
