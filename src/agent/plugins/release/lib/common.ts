// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
export var releaseVars = <any>{};
releaseVars.agentReleaseDirectory = 'agent.releaseDirectory';
releaseVars.systemArtifactsDirectory = 'system.artifactsDirectory';
releaseVars.skipArtifactsDownload = 'release.skipartifactsDownload';
releaseVars.releaseId = 'release.releaseId';
releaseVars.buildId = 'build.buildId';
releaseVars.releaseDefinitionName = 'release.definitionName';

export function reviver(key, val) {
    if (key) {
        this[key.charAt(0).toLowerCase() + key.slice(1)] = val;
    }
    else {
        return val;
    }
}