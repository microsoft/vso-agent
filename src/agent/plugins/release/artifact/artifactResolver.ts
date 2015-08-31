// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import context = require('../../../context');
import jenkinsArtifact = require('./jenkinsArtifact');
import buildArtifact = require('./buildArtifact');


export class ArtifactResolver {
    constructor() {
    }

    public download(context: context.JobContext, artifactDefinition: releaseIfm.AgentArtifactDefinition, artifactsFolder: string, asyncCallback): void {
        if (artifactDefinition.artifactType === releaseIfm.AgentArtifactType.Jenkins) {
            new jenkinsArtifact.JenkinsArtifact().download(context, artifactDefinition, artifactsFolder, asyncCallback);
        }
        else if (artifactDefinition.artifactType === releaseIfm.AgentArtifactType.Build) {
            new buildArtifact.BuildArtifact().download(context, artifactDefinition, artifactsFolder, asyncCallback);
        }
        else {
            asyncCallback('The artifact type is not yet supported: ' + artifactDefinition.artifactType);
        }
    }
}