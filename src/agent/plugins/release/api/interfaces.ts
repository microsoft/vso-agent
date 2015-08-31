// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import context = require('../../../context');
import http = require("http");
import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');

export interface IArtifact {
    download(context: context.JobContext, artifactDefinition: releaseIfm.AgentArtifactDefinition, artifactsFolder: string, asyncCallback): void;
}