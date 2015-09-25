// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

//import shell = require('shelljs');
import path = require('path');
import fs = require('fs');
var url = require('url');
import async = require('async');
import ctxm = require('../../context');
import ifm = require('../../api/interfaces');
import gitrepo = require('./lib/gitrepo');
import Q = require('q');
import shell = require('shelljs');

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

    //------------------------------------------------------------
    // Get Code from Repos
    //------------------------------------------------------------

    var endpoints: ifm.JobEndpoint[] = ctx.job.environment.endpoints;

    var variables = ctx.job.environment.variables;    

    var srcendpoints = endpoints.filter(function (endpoint: ifm.JobEndpoint) {
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
    var endpoint: ifm.JobEndpoint = srcendpoints[0];

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
    
    var scmProvider = scmm.getProvider(ctx, repoPath);
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
