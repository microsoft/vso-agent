// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import context = require('../../context');
import common = require('../../common');
import utilm = require('../../utilities');
import releaseCommon = require('./lib/common');
import webapim = require('vso-node-api/WebApi');
import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import releaseVars = require('./lib/common');
import artifactResolver = require('./artifact/artifactResolver');
import path = require('path');
import crypto = require('crypto');
var async = require('async');
var shell = require("shelljs");

export function pluginName() {
    return "Download artifacts";
}

// what shows in progress view
export function pluginTitle() {
    return "pluginTitle: Downloading artifacts";
}

export function beforeJob(context: context.JobContext, callback) {
    context.info('Prepare artifacts download.');

    var skipArtifactDownload = context.job.environment.variables[releaseCommon.releaseVars.skipArtifactsDownload].toLowerCase() === 'true';
    var releaseId = +context.job.environment.variables[releaseCommon.releaseVars.releaseId];
    var teamProjectId = context.job.environment.variables[common.sysVars.teamProjectId];
    context.info('SkipArtifactsDownload=' + skipArtifactDownload + ', ReleaseId=' + releaseId + ', TeamProjectId=' + teamProjectId);

    var artifactsFolder = path.join(context.workingDirectory, 'release', createHash(teamProjectId));
    context.info('Artifacts folder:' + artifactsFolder);

    var serverUrl = context.job.environment.systemConnection.url;
    var rmClient = new webapim.WebApi(serverUrl, context.jobInfo.systemAuthHandler).getQReleaseManagemntApi();
    rmClient.getAgentArtifactDefinitions(teamProjectId, releaseId).then((artifactDefinitions: releaseIfm.AgentArtifactDefinition[]) => {
        if (skipArtifactDownload) {
            context.info('Skipping artifact download based on the setting specified.')
            utilm.ensurePathExists(artifactsFolder).then(() => {
                setLocalVariables(context, artifactsFolder, artifactDefinitions);
                callback();
                return;
            }).fail((err) => {
                callback(err);
                return;
            });
        }
        else {
            try {
                cleanUpArtifactsDirectory(context, artifactsFolder);
            }
            catch (error) {
                context.info('Clean up of the artifacts directory failed.')
                callback(error);
                return;
            }

            context.info('Number of artifacts to download: ' + artifactDefinitions.length);
            context.info('Starting artifacts download...');
            async.forEach(artifactDefinitions, function (artifactDefinition, asyncCallback) {
                new artifactResolver.ArtifactResolver().download(context, artifactDefinition, artifactsFolder, asyncCallback);
            }, function (err) {
                    if (err) {
                        context.info('There was problem in downloading the artifacts');
                        callback(err);
                        return;
                    }

                    context.info('Finished artifacts download.');
                    setLocalVariables(context, artifactsFolder, artifactDefinitions);
                    callback();
                    return;
                });
        }
    }).fail((err) => {
        callback(err);
        return;
    });
}

function cleanUpArtifactsDirectory(context: context.JobContext, artifactsFolder: string): void {
    context.info('Cleaning artifacts directory: ' + artifactsFolder);
    shell.rm('-rf', artifactsFolder);
    shell.mkdir('-p', artifactsFolder);
    context.info('Cleaned artifacts directory: ' + artifactsFolder);
}

function createHash(teamProject: string): string {
    var hashProvider = crypto.createHash("sha256");
    hashProvider.update(teamProject, 'utf8');
    return hashProvider.digest('hex');
}

function setLocalVariables(context: context.JobContext, artifactsFolder: string, artifactDefinitions: releaseIfm.AgentArtifactDefinition[]): void {
    if (artifactDefinitions.length === 1 && artifactDefinitions[0].artifactType === releaseIfm.AgentArtifactType.Build) {
        context.job.environment.variables[releaseCommon.releaseVars.buildId] = artifactDefinitions[0].version;
    }

    context.job.environment.variables[releaseCommon.releaseVars.agentReleaseDirectory] = artifactsFolder;
    context.job.environment.variables[releaseCommon.releaseVars.systemArtifactsDirectory] = artifactsFolder;
}