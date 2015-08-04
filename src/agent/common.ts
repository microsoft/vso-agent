// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/Q.d.ts" />
/// <reference path="./definitions/vso-node-api.d.ts" />

import Q = require('q');
import dm = require('./diagnostics');
import path = require('path');
import inputs = require('./inputs');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import basicm = require('vso-node-api/handlers/basiccreds')
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import ifm = require('./api/interfaces');
import taskm = require('vso-node-api/TaskApi');
import webapi = require('vso-node-api/WebApi');
import cfgm = require('./configuration');

var crypto = require('crypto');
var zip = require('adm-zip');
var fs = require('fs');

require('./extensions');

export var sysVars = <any>{};
sysVars.system = 'system';
sysVars.collectionId = 'system.collectionId';
sysVars.definitionId = 'system.definitionId';
sysVars.tfsUri = 'system.teamFoundationServerUri';
sysVars.collectionUri = 'system.teamFoundationCollectionUri';
sysVars.teamProjectId = 'system.teamProjectId';
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
export var envCredTrace: string = 'VSO_CRED_TRACE';
export var envVerbose: string = 'VSO_AGENT_VERBOSE';

// comma delimited list of envvars to ignore when registering agent with server
export var envIgnore: string = 'VSO_AGENT_IGNORE';
export var envService: string = 'VSO_AGENT_SVC';
export var envWorkerDiagPath: string = 'WORKER_DIAG_PATH';

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
// Agent Errors
//-----------------------------------------------------------
export enum AgentError {
    // config errors 100 - 199
    PoolNotExist = 100,
    AgentNotExist = 101
}

export function throwAgentError(errorCode: AgentError, message: string) {
    var err = new Error(message);
    err['errorCode'] = errorCode;
    throw err;
}

//-----------------------------------------------------------
// Constants
//-----------------------------------------------------------
export var CMD_PREFIX: string = '##vso[';
export var DEFAULT_LOG_LINESPERFILE = 5000;
export var DEFAULT_LOG_MAXFILES = 5;

//-----------------------------------------------------------
// Interfaces
//-----------------------------------------------------------

export interface IStringDictionary { [name: string]: string }

export interface IDiagnosticWriter {
    level: DiagnosticLevel;
    write(message: string): void;
    writeError(message: string): void;
    end(): void;
}

export interface ITraceWriter {
    trace(message: string): void;
}

export interface ILogSettings {
    linesPerFile: number;
    maxFiles: number;
}

// settings are user input & stored in settings file (.agent)
export interface ISettings {
    poolName: string;
    serverUrl: string;
    agentName: string;
    workFolder: string;
    logSettings: ILogSettings;
}

// contains configuration data from server, runtime creds + settings
// this is not persisted but read from settings, server and/or user at runtime
export interface IConfiguration {
    settings: ISettings;
    poolId: number;
    createDiagnosticWriter?: () => IDiagnosticWriter;
    agent: agentifm.TaskAgent;
}

export interface IFeedbackChannel extends NodeJS.EventEmitter {
    agentUrl: string;
    collectionUrl: string;
    taskApi: taskm.ITaskApi;
    jobInfo: IJobInfo;
    enabled: boolean;

    // lifetime
    drain(): Q.Promise<any>;

    // queues
    queueLogPage(page: ILogPageInfo): void;
    queueConsoleLine(line: string): void;
    queueConsoleSection(line: string): void;
    createAsyncCommandQueue(workerCtx: any): IAsyncCommandQueue;

    // timelines
    addError(recordId: string, category: string, message: string, data: any): void;
    addWarning(recordId: string, category: string, message: string, data: any): void;
    setCurrentOperation(recordId: string, operation: string): void;
    setName(recordId: string, name: string): void;
    setStartTime(recordId: string, startTime: Date): void;
    setFinishTime(recordId: string, finishTime: Date): void;
    setState(recordId: string, state: agentifm.TimelineRecordState): void;
    setResult(recordId: string, result: agentifm.TaskResult): void;
    setType(recordId: string, type: string): void;
    setParentId(recordId: string, parentId: string): void;
    setWorkerName(recordId: string, workerName: string): void;
    setLogId(recordId: string, logRef: agentifm.TaskLogReference): void;
    setOrder(recordId: string, order: number): void;

    // drops
    uploadFileToContainer(containerId: number, containerItemTuple: ifm.ContainerItemInfo): Q.Promise<any>;
    postArtifact(projectId: string, buildId: number, artifact: buildifm.BuildArtifact): Q.Promise<buildifm.BuildArtifact>;

    // job
    finishJobRequest(poolId: number, lockToken: string, jobRequest: agentifm.TaskAgentJobRequest): Q.Promise<any>;

    // test publishing 
    initializeTestManagement(projectName: string): void;
    createTestRun(testRun: ifm.TestRun): Q.Promise<ifm.TestRun>;
    endTestRun(testRunId: number): Q.Promise<ifm.TestRun>;
    createTestRunResult(testRunId: number, testRunResults: ifm.TestRunResult[]): Q.Promise<ifm.TestRunResult[]>;
    createTestRunAttachment(testRunId: number, fileName: string, contents: string): Q.Promise<any>;
}

export interface IAsyncCommandQueue {
    push(command: IAsyncCommand): void;
    finishAdding(): void;
    waitForEmpty(): Q.Promise<any>;
    startProcessing(): void;
    _processQueue(commands: IAsyncCommand[], callback: (err: any) => void): void;
    failed: boolean;
    errorMessage: string;
}

export interface ITaskCommand {
    command: string;
    properties: { [name: string]: string };
    message: string;

    // output is buffered per command so it's not interlaced with other task tool output
    lines: string[];
    info(message: string);
    warning(message: string);
    error(message: string);
}

//TODO: get rid of ctx any
export interface ISyncCommand {
    command: ITaskCommand;
    runCommand(ctx: any);
}

export interface IAsyncCommand {
    command: ITaskCommand;
    description: string;
    taskCtx: any;

    runCommandAsync(): Q.Promise<any>;
}

// high level ids for job to avoid passing full job to lower priviledged code
export interface IJobInfo {
    description: string;
    jobId: string;
    planId: string;
    timelineId: string;
    requestId: number;
    lockToken: string;
    systemAuthHandler: baseifm.IRequestHandler;
    variables: { [key: string]: string };
    mask: (input: string) => string;
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

//
// during config, there's no context, working directory or logs.  So, if tracing enabled, we should go to console.
//
export function consoleTrace(message) {
    console.log(new Date().toString() + " : " + message);
}

export function jsonString(obj: any) {
    if (!obj) {
        return '(null)';
    }

    return JSON.stringify(obj, null, 2);
}

//
// get creds from CL args or prompt user if not in args
//
export function getCreds(done: (err: any, creds: any) => void): void {
    var creds = {};
    var credInputs = [
        {
            name: 'username', description: 'alternate username', arg: 'u', type: 'string', req: true
        },
        {
            name: 'password', description: 'alternate password', arg: 'p', type: 'password', req: true
        }
    ];

    inputs.get(credInputs, (err, result) => {
        creds['username'] = result['username'];
        creds['password'] = result['password'];
        done(err, creds);
    });
}

var MASK_REPLACEMENT: string = "********";
interface ReplacementFunction {
    (input: string): string;
};

interface ReplacementPosition {
    start: number;
    length: number;
};

interface IndexFunction {
    (input: string): ReplacementPosition[];
}

function createMaskFunction(jobEnvironment: agentifm.JobEnvironment): ReplacementFunction {
    var noReplacement = (input: string) => {
        return input;
    };

    var envMasks = jobEnvironment.mask || [];
    var maskHints = [];
    envMasks.forEach((maskHint: agentifm.MaskHint) => { 
        if (maskHint.type === agentifm.MaskType.Variable && maskHint.value) {
            if (jobEnvironment.variables[maskHint.value]) {
                maskHints.push(maskHint);
            }
        }
    });

    if (maskHints.length === 0) {
        return noReplacement;
    }
    else if (maskHints.length === 1) {
        var maskHint = maskHints[0];
        if (maskHint.type === agentifm.MaskType.Variable) {
            var toReplace = jobEnvironment.variables[maskHint.value];
            return (input: string) => {
                return input.replace(toReplace, MASK_REPLACEMENT);
            };
        }
        return noReplacement;
    }
    else {
        // multiple strings to replace
        var indexFunctions: IndexFunction[] = [];
        maskHints.forEach((maskHint: agentifm.MaskHint, index: number) => {
            if (maskHint.type === agentifm.MaskType.Variable) {
                var toReplace = jobEnvironment.variables[maskHint.value];
                indexFunctions.push((input: string) => {
                    var results: ReplacementPosition[] = [];
                    var index: number = input.indexOf(toReplace);
                    while (index > -1) {
                        results.push({ start: index, length: toReplace.length });
                        index = input.indexOf(toReplace, index + 1);
                    }
                    return results;
                });
            }
        });

        return (input: string) => {
            // gather all the substrings to replace
            var substrings: ReplacementPosition[] = [];
            indexFunctions.forEach((find: IndexFunction) => {
                substrings = substrings.concat(find(input));
            });

            // order substrings by start index
            substrings = substrings.sort((a, b) => {
                return a.start - b.start;
            });

            // merge
            var replacements: ReplacementPosition[] = [];
            var currentReplacement: ReplacementPosition;
            var currentEnd: number;
            for (var i: number = 0; i < substrings.length; i++) {
                if (!currentReplacement) {
                    currentReplacement = substrings[i];
                    currentEnd = currentReplacement.start + currentReplacement.length;
                }
                else {
                    if (substrings[i].start <= currentEnd) {
                        // overlap
                        currentEnd = Math.max(currentEnd, substrings[i].start + substrings[i].length);
                        currentReplacement.length = currentEnd - currentReplacement.start;
                    }
                    else {
                        //no overlap
                        replacements.push(currentReplacement);
                        currentReplacement = substrings[i];
                        currentEnd = currentReplacement.start + currentReplacement.length;
                    }
                }
            }
            if (currentReplacement) {
                replacements.push(currentReplacement);
            }

            // replace in reverse order
            var charArray = input.split("");
            for (var i: number = replacements.length - 1; i >= 0; i--) {
                charArray.splice(replacements[i].start, replacements[i].length, "*", "*", "*", "*", "*", "*", "*", "*");
            }

            return charArray.join("");
        };
    }
}

export function jobInfoFromJob(job: agentifm.JobRequestMessage, systemAuthHandler: baseifm.IRequestHandler): IJobInfo {
    var info: IJobInfo = {
        description: job.jobName,
        jobId: job.jobId,
        planId: job.plan.planId,
        timelineId: job.timeline.id,
        requestId: job.requestId,
        lockToken: job.lockToken,
        systemAuthHandler: systemAuthHandler,
        variables: job.environment.variables,
        mask: createMaskFunction(job.environment)
    };

    return info;
}

export function versionStringFromTaskDef(task: agentifm.TaskDefinition): string {
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
    } catch (err) {
        done(new Error('Failed to extract zip: ' + source));
    }
}

export function getWorkPath(config: IConfiguration) {
    var rootAgentDir = path.join(__dirname, '..');
    return path.resolve(rootAgentDir, config.settings.workFolder);
}

export function getWorkerDiagPath(config: IConfiguration) {
    return path.join(getWorkPath(config), '_diag');
}

export function getWorkerLogsPath(config: IConfiguration) {
    return path.join(getWorkPath(config), '_logs');    
}

//-----------------------------------------------------------
// Cred Utilities
//-----------------------------------------------------------
export function basicHandlerFromCreds(creds: baseifm.IBasicCredentials): basicm.BasicCredentialHandler {
    return new basicm.BasicCredentialHandler(creds.username, creds.password);
}

// gets basic creds from args or prompts
export function readBasicCreds(): Q.Promise<baseifm.IBasicCredentials> {
    var defer = Q.defer();

    var credInputs = [
        {
            name: 'username', description: 'alternate username', arg: 'u', type: 'string', req: true
        },
        {
            name: 'password', description: 'alternate password', arg: 'p', type: 'password', req: true
        }
    ];

    inputs.get(credInputs, (err, result) => {
        if (err) {
            defer.reject(err);
            return;
        }

        var cred: baseifm.IBasicCredentials = <baseifm.IBasicCredentials>{};
        cred.username = result['username'];
        cred.password = result['password'];
        defer.resolve(cred);
    });

    return <Q.Promise<baseifm.IBasicCredentials>>defer.promise;
}
