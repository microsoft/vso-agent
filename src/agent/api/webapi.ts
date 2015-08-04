// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import ifm = require('./interfaces');
import agentm = require('./agentapi');
import buildm = require('./buildapi');
import timelinem = require('./timelineapi');
import filecontainerm = require('./filecontainerapi');
import taskm = require('./taskapi');
import apivm = require('./handlers/apiversion');
import basicm = require('./handlers/basiccreds');
import bearm = require('./handlers/bearertoken');
import testm = require('./testmanagementapi');

export function versionHandler(apiVersion: string) {
	return new apivm.ApiVersionHandler(apiVersion);
}

export function basicHandler(username: string, password: string) {
	return new basicm.BasicCredentialHandler(username, password);
}

export function bearerHandler(token) {
	return new bearm.BearerCredentialHandler(token);
}

// ---------------------------------------------------------------------------
// factory to return hostapi (for building build host/agents) or buildapi (for querying and queuing builds)
//----------------------------------------------------------------------------
export function AgentApi(serverUrl: string, authHandler: ifm.IRequestHandler): ifm.IAgentApi {
    return new agentm.AgentApi(serverUrl, [authHandler, versionHandler('1.0')]); 
}

export function QAgentApi(serverUrl: string, authHandler: ifm.IRequestHandler): ifm.IQAgentApi {
    return new agentm.QAgentApi(serverUrl, [authHandler, versionHandler('1.0')]);    
}

export function QBuildApi(serverUrl: string, authHandler: ifm.IRequestHandler): ifm.IQBuildApi {
    return new buildm.QBuildApi(serverUrl, [authHandler, versionHandler('2.0-preview')]);    
}

export function QFileContainerApi(serverUrl: string, authHandler: ifm.IRequestHandler): ifm.IQFileContainerApi {
    return new filecontainerm.QFileContainerApi(serverUrl, [authHandler, versionHandler('1.0; res-version=3')]);    
}

export function TimelineApi(scopeIdentifier: string, hubName:string, collectionUrl: string, authHandler: ifm.IRequestHandler): ifm.ITimelineApi {
    return new timelinem.TimelineApi(scopeIdentifier, hubName, collectionUrl, [authHandler, versionHandler('2.0-preview.1')]);   
}

export function TaskApi(serverUrl: string, authHandler: ifm.IRequestHandler): ifm.ITaskApi {
    return new taskm.TaskApi(serverUrl, [authHandler, versionHandler('1.0')]);
}

export function TestManagementApi(serverUrl: string, authHandler: ifm.IRequestHandler): ifm.ITestManagementApi {
    return new testm.TestManagementApi(serverUrl, [authHandler, versionHandler('2.0-preview')]); 
}

export function QTestManagementApi(serverUrl: string, authHandler: ifm.IRequestHandler): ifm.IQTestManagementApi {
    return new testm.QTestManagementApi(serverUrl, [authHandler, versionHandler('2.0-preview')]);
}
