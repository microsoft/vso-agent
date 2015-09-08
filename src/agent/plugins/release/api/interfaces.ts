// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import common = require('../../../common');
import http = require("http");
import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');

export interface IArtifact {
    download(context: common.IExecutionContext, artifactDefinition: releaseIfm.AgentArtifactDefinition, artifactsFolder: string, asyncCallback): void;
}