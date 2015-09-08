// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import common = require('../../common');
import utilm = require('../../utilities');
import releaseCommon = require('./lib/common');
import webapim = require('vso-node-api/WebApi');
import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import releaseVars = require('./lib/common');
import artifactResolver = require('./artifact/artifactResolver');
import path = require('path');
import crypto = require('crypto');
import Q = require('q');
var async = require('async');
var shell = require("shelljs");

export function pluginName() {
    return "Download artifacts";
}

// what shows in progress view
export function pluginTitle() {
    return "pluginTitle: Downloading artifacts";
}

export function beforeJob(context: common.IExecutionContext, callback) {
    context.info('Prepare artifacts download.');

    var skipArtifactDownload = context.variables[releaseCommon.releaseVars.skipArtifactsDownload].toLowerCase() === 'true';
    var releaseId = +context.variables[releaseCommon.releaseVars.releaseId];
    var teamProjectId = context.variables[common.sysVars.teamProjectId];
    var releaseDefinitionName = context.variables[releaseCommon.releaseVars.releaseDefinitionName];
    context.info('SkipArtifactsDownload=' + skipArtifactDownload + ', ReleaseId=' + releaseId + ', TeamProjectId=' + teamProjectId + ', ReleaseDefintionName=' + releaseDefinitionName);

    var artifactsFolder = path.join(context.workingDirectory, 'release', createHash(teamProjectId, releaseDefinitionName));
    context.info('Artifacts folder:' + artifactsFolder);

    var serverUrl = context.jobInfo.jobMessage.environment.systemConnection.url;
    var rmClient = new webapim.WebApi(serverUrl, context.jobInfo.systemAuthHandler).getQReleaseManagemntApi();
    rmClient.getAgentArtifactDefinitions(teamProjectId, releaseId).then((artifactDefinitions: releaseIfm.AgentArtifactDefinition[]) => {
        if (skipArtifactDownload) {
            context.info('Skipping artifact download based on the setting specified.')
            utilm.ensurePathExists(artifactsFolder).then(() => {
                setAndLogLocalVariables(context, artifactsFolder, artifactDefinitions);
                callback();
                return;
            }).fail((err) => {
                callback(err);
                return;
            });
        }
        else {
            cleanUpArtifactsDirectory(context, artifactsFolder, callback);

            context.info('Number of artifacts to download: ' + artifactDefinitions.length);
            context.info('Starting artifacts download...');

            var promises = artifactDefinitions.map((artifactDefinition: releaseIfm.AgentArtifactDefinition) => {
                var artifactFolder = path.join(artifactsFolder, artifactDefinition.alias);
                return utilm.ensurePathExists(artifactFolder).then(() => new artifactResolver.ArtifactResolver().download(context, artifactDefinition, artifactFolder));
            });

            Q.all(promises).then(() => {
                context.info('Finished artifacts download.');
                setAndLogLocalVariables(context, artifactsFolder, artifactDefinitions);
                callback();
                return;
            }).fail((err) => {
                context.info('There was problem in downloading the artifacts');
                callback(err);
                return;
            });
        }
    }).fail((err) => {
        callback(err);
        return;
    });
}

function cleanUpArtifactsDirectory(context: common.IExecutionContext, artifactsFolder: string, callback): void {
    context.info('Cleaning artifacts directory: ' + artifactsFolder);
    shell.rm('-rf', artifactsFolder);
    var errorMessage = shell.error();
    if (errorMessage) {
        callback(errorMessage);
    }
    shell.mkdir('-p', artifactsFolder);
    errorMessage = shell.error();
    if (errorMessage) {
        callback(errorMessage);
    }
    context.info('Cleaned artifacts directory: ' + artifactsFolder);
}

function createHash(teamProject: string, releaseDefinitionName: string): string {
    var hashProvider = crypto.createHash("sha256");
    var hashInput = teamProject + ':' + releaseDefinitionName;
    hashProvider.update(hashInput, 'utf8');
    return hashProvider.digest('hex');
}

function setAndLogLocalVariables(context: common.IExecutionContext, artifactsFolder: string, artifactDefinitions: releaseIfm.AgentArtifactDefinition[]): void {
    if (artifactDefinitions.length === 1 && artifactDefinitions[0].artifactType === releaseIfm.AgentArtifactType.Build) {
        context.variables[releaseCommon.releaseVars.buildId] = artifactDefinitions[0].version;
    }

    context.variables[releaseCommon.releaseVars.agentReleaseDirectory] = artifactsFolder;
    context.variables[releaseCommon.releaseVars.systemArtifactsDirectory] = artifactsFolder;

    context.verbose('Environment variables available are below.  Note that these environment variables can be referred to in the task (in the ReleaseDefinition) by replacing "_" with "." e.g. AGENT_WORKINGDIRECTORY environment variable can be referenced using Agent.WorkingDirectory in the ReleaseDefinition:' + JSON.stringify(context.variables, null, 2));
}