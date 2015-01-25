// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

//import shell = require('shelljs');
import path = require('path');
import fs = require('fs');
import async = require('async');
import ctxm = require('../../context');
import ifm = require('../../api/interfaces');
import gitrepo = require('./lib/gitrepo');

var supported: string[] = ['TfsGit', 'Git'];

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

    // TODO: support TfsVersionControl
    var invalidType: string;
    endpoints.every((endpoint) => {
        if (supported.indexOf(endpoint.type) < 0) {
            invalidType = endpoint.type;
            return false;
        }
    });

    if (invalidType) {
        var msg = 'Unsupported repository type:' + invalidType;
        ctx.error(msg)
        callback(new Error(msg));
        return;
    }

    var variables = ctx.job.environment.variables;

    var srcVersion = variables['build.sourceVersion'];
    var srcBranch = variables['build.sourceBranch'];
    ctx.info('srcVersion: ' + srcVersion);
    ctx.info('srcBranch: ' + srcBranch);

    var tfcreds = { username: process.env.altusername, password: process.env.altpassword };
    var selectedRef = srcVersion ? srcVersion : srcBranch;
    ctx.info('selectedRef: ' + selectedRef);

    var srcendpoints = endpoints.filter(function (endpoint) {
        return (supported.indexOf(endpoint.type) >= 0);
    });

    // TODO: we only really support one.  Consider changing to index 0 of filter result and warn | fail if length > 0
    //       what's odd is we will set sys.sourceFolder so > 1 means last one wins
    async.forEachSeries(srcendpoints, function (endpoint, done) {
        
        //TODO: confirm how external git and github creds flow down
        var creds = tfcreds; //endpoint.type === 'TfsGit' ? tfcreds : endpoint.creds;
        var options = {
            repoLocation: endpoint.url,
            ref: selectedRef,
            creds: creds,
            localPath: 'repo', // not allowing custom local paths - we always put in repo
            submodules: endpoint.data['checkoutSubmodules'] === "True",
            clean: endpoint.data['clean'] === "true"
        };

        var repoPath = path.resolve(options.localPath);
        ctx.job.environment.variables['build.sourceDirectory'] = repoPath;
        ctx.job.environment.variables['build.stagingdirectory'] = path.resolve("staging");

        // TODO: remove compat variable
        ctx.job.environment.variables['sys.sourcesFolder'] = repoPath;
        gitrepo.getcode(ctx, options, done);
    }, function (err) {
        callback(err);
    });
}
