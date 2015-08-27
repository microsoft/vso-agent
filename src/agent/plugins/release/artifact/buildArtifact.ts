// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import rmInterfaces = require('../api/interfaces');
import context = require('../../../context');
import webapim = require('vso-node-api/WebApi');
import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import buildIfm = require('vso-node-api/interfaces/BuildInterfaces')
import barr = require('./buildArtifactResolver');
import releaseCommon = require('../lib/common');
var async = require('async');

export class BuildArtifact implements rmInterfaces.IArtifact {
    public download(context: context.JobContext, artifactDefinition: releaseIfm.AgentArtifactDefinition, artifactsFolder: string, asyncCallback): void {
        try {
            var buildDetails: releaseIfm.AgentTfsBuildArtifactDetails = JSON.parse(artifactDefinition.details, releaseCommon.reviver);
            var serverUrl = context.job.environment.systemConnection.url;
            var buildClient = new webapim.WebApi(serverUrl, context.jobInfo.systemAuthHandler).getQBuildApi();
            buildClient.getArtifacts(+artifactDefinition.version, buildDetails.project).then((buildArtifacts: buildIfm.BuildArtifact[]) => {
                if (buildArtifacts.length === 0) {
                    asyncCallback('No artifacts are available in the build ' + artifactDefinition.version + '. Make sure that the build is publishing an artifact and try again.');
                }

                async.forEach(buildArtifacts, function (buildArtifact, asynCallback2) {
                    new barr.BuildArtifactResolver().resolve(context, buildDetails, buildArtifact, +artifactDefinition.version, artifactsFolder, asynCallback2);
                }, function (err) {
                        if (err) {
                            asyncCallback(err);
                            return;
                        }

                        asyncCallback();
                        return;
                    });

            }).fail((err) => {
                asyncCallback(err);
                return;
            });
        }
        catch (error) {
            asyncCallback(error);
        }
    }
}