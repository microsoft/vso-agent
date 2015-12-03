// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
import smm = require('./sourceMappings');

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
    var variables: {[key: string]: string} = job.environment.variables;
    
    //
    // Get the valid scm providers and filter endpoints
    //

    var supported = [];
    var filter = path.join(executionContext.scmPath, '*.js');
    shell.ls(filter).forEach((provPath: string) => {
        supported.push(path.basename(provPath, '.js'));
    })
    executionContext.debug('valid scm providers: ' + supported);
    
    var endpoints: agentifm.ServiceEndpoint[] = job.environment.endpoints;
    var srcendpoints = endpoints.filter(function (endpoint: agentifm.ServiceEndpoint) {
        if (!endpoint.type) {
            return false;
        }
        
        executionContext.info('Repository type: ' + endpoint.type);
        return (supported.indexOf(endpoint.type.toLowerCase()) >= 0);
    });

    if (srcendpoints.length == 0) {
        callback(new Error('Unsupported SCM system.  Supported: ' + supported.toString()));
        return;
    }
    
    // only support 1 SCM system
    var endpoint: agentifm.ServiceEndpoint = srcendpoints[0];

    //
    // Get SCM plugin
    //
    var scmm;
    var providerType = endpoint.type.toLowerCase();
    executionContext.info('using source provider: ' + providerType);

    try {        
        var provPath = path.join(executionContext.scmPath, providerType);
        executionContext.info('loading: ' + provPath);
        scmm = require(provPath);
    }
    catch(err) {
        callback(new Error('Source Provider failed to load: ' + providerType));
        return;        
    }
    
    if (!scmm.getProvider) {
        callback(new Error('SCM Provider does not implement getProvider: ' + providerType));
        return;
    }
    
    var scmProvider: cm.IScmProvider = scmm.getProvider(executionContext, endpoint);
    scmProvider.initialize();
    scmProvider.debugOutput = executionContext.debugOutput;
    var hashKey: string = scmProvider.hashKey;
    
    //
    // Get source mappings and set variables
    //
    var workingFolder = variables[cm.vars.agentWorkingDirectory];
    var repoPath: string;
    
    var sm: smm.SourceMappings = new smm.SourceMappings(workingFolder, executionContext.hostContext);
    sm.supportsLegacyPaths = endpoint.type !== 'tfsversioncontrol';
    sm.getSourceMapping(hashKey, job, endpoint)
    .then((srcMap: smm.ISourceMapping) => {
        repoPath = scmProvider.targetPath = path.join(workingFolder, srcMap.build_sourcesdirectory);

        //
        // Variables
        //        
        // back compat
        variables['build.sourceDirectory'] = repoPath;     
                
        variables[cm.vars.buildSourcesDirectory] = repoPath;
        variables[cm.vars.buildArtifactStagingDirectory] = path.join(workingFolder, srcMap.build_artifactstagingdirectory);

        // back compat with old publish artifacts task
        variables[cm.vars.buildStagingDirectory] = variables[cm.vars.buildArtifactStagingDirectory];

        variables[cm.vars.commonTestResultsDirectory] = path.join(workingFolder, srcMap.common_testresultsdirectory);
        var bd = variables[cm.vars.agentBuildDirectory] = path.join(workingFolder, srcMap.agent_builddirectory);
        shell.mkdir('-p', bd);
        shell.cd(bd);
        
        if (endpoint.data['clean'].replaceVars(job.environment.variables) === "true") {
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
            executionContext.info('running incremental');
            return 0;
        }
    })
    .then((code: number) => {
        executionContext.info('getting code');
        return scmProvider.getCode();
    })
    .then((code: number) => {
        executionContext.info('CD: ' + repoPath);
        shell.cd(repoPath);
        callback();
    })    
    .fail((err) => {
        callback(err);
        return;
    })

}
