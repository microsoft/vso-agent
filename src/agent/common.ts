// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import dm = require('./diagnostics');
import path = require('path');
import inputs = require('./inputs');
import ifm = require('./api/interfaces');
import basicm = require('./api/basiccreds');
import webapi = require('./api/webapi');
import cfgm = require('./configuration');

var crypto = require('crypto');
var zip = require('adm-zip');
var fs = require('fs');

require('./extensions');

export var sysVars = <any>{};
sysVars.system = 'system';
sysVars.collectionId = 'system.collectionId';
sysVars.definitionId = 'system.definitionId';
sysVars.debug = 'system.debug';

export var agentVars = <any>{};
agentVars.rootDirectory = 'agent.rootDirectory';
agentVars.buildDirectory = 'agent.buildDirectory';
agentVars.workingDirectory = 'agent.workingDirectory';

// TODO: should be in build plugin
export var buildVars = <any>{};
buildVars.sourceDirectory = 'build.sourceDirectory';
buildVars.stagingDirectory = 'build.stagingDirectory';

//-----------------------------------------------------------
// ENV VARS
//-----------------------------------------------------------
export var envTrace: string = 'VSO_AGENT_TRACE';
export var envVerbose: string = 'VSO_AGENT_VERBOSE';

// comma delimited list of envvars to ignore when registering agent with server
export var envIgnore: string  = 'VSO_AGENT_IGNORE';
export var envService: string = 'VSO_AGENT_SVC';

//-----------------------------------------------------------
// Enums
//-----------------------------------------------------------
export enum DiagnosticLevel {
	Error = 1,
	Warning = 2,
	Status = 3,
	Info = 4,
	Verbose = 5
}

//-----------------------------------------------------------
// Interfaces
//-----------------------------------------------------------
export interface IDiagnosticWriter {
	level: DiagnosticLevel;
	write(message: string): void;
	writeError(message: string): void;
	end(): void;
}

export interface ITraceWriter {
	trace(message: string): void;
}

// settings are user input & stored in settings file (.agent)
export interface ISettings {
	poolName: string;
	serverUrl: string;
	agentName: string;
	workFolder: string;
}

// contains configuration data from server, runtime creds + settings
// this is not persisted but read from settings, server and/or user at runtime
export interface IConfiguration {
	settings: ISettings;
	poolId: number;
	creds: any;
}

export interface IFeedbackChannel {
	agentUrl: string;
	taskUrl: string;
	timelineApi: ifm.ITimelineApi;
	jobInfo: IJobInfo;	
	enabled: boolean;

	// lifetime
	drain(callback: (err: any) => void): void;

	// queues
	queueLogPage(page: ILogPageInfo): void;
	queueConsoleLine(line: string): void;
	queueConsoleSection(line: string): void;

	// timelines
	setCurrentOperation(recordId: string, operation: string): void;
	setName(recordId: string, name: string): void;
	setStartTime(recordId: string, startTime: Date): void;
	setFinishTime(recordId: string, finishTime: Date): void;
	setState(recordId: string, state: ifm.TimelineRecordState): void;
	setResult(recordId: string, result: ifm.TaskResult): void;
	setType(recordId: string, type: string): void;
	setParentId(recordId: string, parentId: string): void;
	setWorkerName(recordId: string, workerName: string): void;
	setLogId(recordId: string, logRef: ifm.TaskLogReference): void;
	setOrder(recordId: string, order: number): void;

	// job
	updateJobRequest(poolId: number, lockToken: string, jobRequest: ifm.TaskAgentJobRequest, callback: (err: any) => void): void;
}


// high level ids for job to avoid passing full job to lower priviledged code
export interface IJobInfo {
	description: string;
	jobId: string;
	planId: string;
	timelineId: string;
	requestId: number;
	lockToken: string;
	variables: { [key: string]: string };
}

export interface ILogMetadata {
	recordId: string;
	jobInfo: IJobInfo;
	pagesId: string;
	logPath: string;
}

export interface ILogPageInfo {
	logInfo: ILogMetadata;
	pagePath: string;
	pageNumber: number;
}

//-----------------------------------------------------------
// Helpers
//-----------------------------------------------------------

export function jsonString(obj: any) {
	if (!obj) {
		return '(null)';
	}

	return JSON.stringify(obj, null, 2);
}

//
// get creds from CL args or prompt user if not in args
//
export function getCreds(done: (err:any, creds:any) => void): void {
	var creds = {};
	var credInputs = [
		{
			name: 'username', description: 'alternate username', arg: 'u', type: 'string', req: true
		},
		{
			name: 'password', description: 'alternate password', arg: 'p', type: 'string', req: true
		}
	];

	inputs.get(credInputs, (err, result) => {
		creds['username'] = result['username'];
		creds['password'] = result['password'];
		done(err, creds);
	});
}

export function jobInfoFromJob (job: ifm.JobRequestMessage): IJobInfo {
    var info = <IJobInfo>{};
    info.description = job.jobName;
    info.jobId = job.jobId;
    info.planId = job.plan.planId;
    info.timelineId = job.timeline.id;
    info.requestId = job.requestId;	
    info.lockToken = job.lockToken;
    info.variables = job.environment.variables;

    return info;
}

export function versionStringFromTaskDef(task: ifm.TaskDefinition): string {
	return task.version.major + '.' + task.version.minor + '.' + task.version.patch;
}

export function sha1HexHash(content: string) {
	return crypto.createHash('sha1').update(content).digest('hex');
}

export function extractFile(source: string, dest: string, done: (err: any) => void) {
	if (!fs.existsSync(source)) {
		done(new Error('Source file ' + source + ' does not exist.'));
		return;
	}

	try {
		var file = new zip(source);
		file.extractAllTo(dest, true);
		done(null);
	} catch(err) {
		done(err);
	}
}

export function createTimelineApi(collectionUrl: string, username: string, password: string): ifm.ITimelineApi {
	var creds: basicm.BasicCredentialHandler = new basicm.BasicCredentialHandler(username, password);
	var timelineApi: ifm.ITimelineApi = webapi.TimelineApi(collectionUrl, creds);
	return timelineApi;
}

export function createAgentApi(serverUrl: string, username: string, password: string): ifm.IAgentApi {
	var creds: basicm.BasicCredentialHandler = new basicm.BasicCredentialHandler(username, password);
	var agentapi: ifm.IAgentApi = webapi.AgentApi(serverUrl, creds);
	return agentapi;
}

export function createTaskApi(serverUrl: string, username: string, password: string): ifm.ITaskApi {
	var creds: basicm.BasicCredentialHandler = new basicm.BasicCredentialHandler(username, password);
	var taskapi: ifm.ITaskApi = webapi.TaskApi(serverUrl, creds);
	return taskapi;
}

export function initAgentApi(serverUrl: string, done: (err:any, api:ifm.IAgentApi, creds: any) => void): void {
	getCreds((err, res) => {
		var agentapi: ifm.IAgentApi = createAgentApi(serverUrl, res['username'], res['password']);
		var creds = {
			username: res['username'], 
			password: res['password']
		};

		done(err, agentapi, creds);
	});
}
