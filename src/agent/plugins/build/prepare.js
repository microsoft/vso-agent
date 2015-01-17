// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var shell = require('shelljs/global');
var path = require('path');
var fs = require('fs');
var async = require('async');
var gitrepo = require('./lib/gitrepo');

var checkShellError = function (callback) {
    if (error()) {
        callback(new Error(error()));
    }
}

exports.pluginName = function () {
    return "prepareWorkspace";
}

// what shows in progress view
exports.pluginTitle = function () {
    return "Preparing Workspace"
}

exports.beforeJob = function (ctx, callback) {
    ctx.info('preparing Workspace');
    ctx.info('cwd: ' + process.cwd());

    //------------------------------------------------------------
    // Get Code from Repos
    //------------------------------------------------------------

    var endpoints = ctx.job.environment.endpoints;

    // TODO: support TfsVersionControl
    var srcendpoints = endpoints.filter(function (endpoint) {
        return endpoint.type === 'TfsGit' || endpoint.type === 'Git';
    });

    ctx.info('endpoints: ' + JSON.stringify(endpoints, null, 2));

    var variables = ctx.job.environment.variables;

    // TODO: remove compat vars after next sprint
    var srcVersion = variables['build.sourceVersion'] || variables['sys.sourceVersion'];
    var srcBranch = variables['build.sourceBranch'] || variables['sys.sourceBranch'];
    ctx.info('srcVersion: ' + srcVersion);
    ctx.info('srcBranch: ' + srcBranch);

    var tfcreds = { username: process.env.altusername, password: process.env.altpassword };
    var selectedRef = srcVersion ? srcVersion : srcBranch;
    ctx.info('selectedRef: ' + selectedRef);

    // TODO: we only really support one.  Consider changing to index 0 of filter result and warn | fail if length > 0
    //       what's odd is we will set sys.sourceFolder so > 1 means last one wins
    async.forEachSeries(srcendpoints, function (endpoint, done) {
        var creds = endpoint.type === 'TfsGit' ? tfcreds : endpoint.creds;
        var options = {
            repoLocation: endpoint.url,
            ref: selectedRef,
            creds: creds,
            localPath: 'repo', // not allowing custom local paths - we always put in repo
            submodules: endpoint.data.checkoutSubmodules === "True",
            clean: endpoint.data.clean === "true"
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
