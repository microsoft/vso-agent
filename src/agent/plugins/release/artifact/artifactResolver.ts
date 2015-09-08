// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import common = require('../../../common');
import jenkinsArtifact = require('./jenkinsArtifact');
import Q = require('q');
import buildArtifact = require('./buildArtifact');


export class ArtifactResolver {
    constructor() {
    }

    public download(context: common.IExecutionContext, artifactDefinition: releaseIfm.AgentArtifactDefinition, artifactFolder: string): Q.Promise<void> {
        if (artifactDefinition.artifactType === releaseIfm.AgentArtifactType.Jenkins) {
            return new jenkinsArtifact.JenkinsArtifact().download(context, artifactDefinition, artifactFolder);
        }
        else if (artifactDefinition.artifactType === releaseIfm.AgentArtifactType.Build) {
            return new buildArtifact.BuildArtifact().download(context, artifactDefinition, artifactFolder);
        }
        else {
            var defer = Q.defer<void>();
            defer.reject('The artifact type is not yet supported: ' + artifactDefinition.artifactType);
            return defer.promise;
        }
    }
}