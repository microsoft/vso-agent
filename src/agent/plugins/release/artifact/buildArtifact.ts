// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import rmInterfaces = require('../api/interfaces');
import common = require('../../../common');
import webapim = require('vso-node-api/WebApi');
import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import buildIfm = require('vso-node-api/interfaces/BuildInterfaces')
import barr = require('./buildArtifactResolver');
import Q = require('q');
import releaseCommon = require('../lib/common');
var async = require('async');

export class BuildArtifact implements rmInterfaces.IArtifact {
    public download(context: common.IExecutionContext, artifactDefinition: releaseIfm.AgentArtifactDefinition, artifactFolder: string): Q.Promise<void> {
        var defer = Q.defer<void>();
        try {
            var buildDetails: releaseIfm.AgentTfsBuildArtifactDetails = JSON.parse(artifactDefinition.details, releaseCommon.reviver);
            var serverUrl = context.jobInfo.jobMessage.environment.systemConnection.url;
            var buildClient = new webapim.WebApi(serverUrl, context.jobInfo.systemAuthHandler).getQBuildApi();
            buildClient.getArtifacts(+artifactDefinition.version, buildDetails.project).then((buildArtifacts: buildIfm.BuildArtifact[]) => {
                if (buildArtifacts.length === 0) {
                    defer.reject('No artifacts are available in the build ' + artifactDefinition.version + '. Make sure that the build is publishing an artifact and try again.');
                }

                var promises: Q.Promise<void>[] = [];
                for (var index = 0; index < buildArtifacts.length; index++) {
                    promises.push(new barr.BuildArtifactResolver().resolve(context, buildDetails, buildArtifacts[index], +artifactDefinition.version, artifactFolder));
                }

                Q.all(promises).then(() => {
                    defer.resolve(null);
                    return;
                }).fail((err) => {
                    defer.reject(err);
                    return;
                });
            }).fail((err) => {
                defer.reject(err);
                return;
            });
        }
        catch (error) {
            defer.reject(error);
            return;
        }

        return defer.promise;
    }
}