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
import fcifm = require('vso-node-api/interfaces/FileContainerInterfaces');
import ifm = require('./interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import taskm = require('vso-node-api/TaskApi');
import webapi = require('vso-node-api/WebApi');
import cfgm = require('./configuration');

var crypto = require('crypto');
var zip = require('adm-zip');
var fs = require('fs');

require('./extensions');

//
// Variables - Keep grouped and ordered
// 
export class AutomationVariables {
    
    //
    // System Variables
    //
    public static system = "system";
    public static systemCollectionId = "system.collectionId";
    public static systemDefinitionId = "system.definitionId";
    public static systemTfsUri = "system.teamFoundationServerUri";
    public static systemTfCollectionUri = 'system.teamFoundationCollectionUri';
    public static systemTeamProjectId = 'system.teamProjectId';
    public static systemDebug = 'system.debug';
    public static systemDefaultWorkingDirectory = 'system.defaultWorkingDirectory';
    public static systemTaskDefinitionsUri = 'system.taskDefinitionsUri';
    public static systemAccessToken = 'system.accessToken';
    public static systemEnableAccessToken = 'system.enableAccessToken';
    
    //
    // Agent Variables
    //    
    public static agentRootDirectory = 'agent.rootDirectory';
    public static agentWorkingDirectory = 'agent.workingDirectory';
    public static agentWorkFolder = 'agent.workFolder';
    public static agentHomeDirectory = 'agent.homeDirectory';
    public static agentAgentId = 'agent.agentId';
    public static agentBuildDirectory = 'agent.buildDirectory';
    
    //
    // Build Variables
    //
    public static buildSourcesDirectory = 'build.sourcesDirectory';
    public static buildArtifactStagingDirectory = 'build.artifactStagingDirectory';
    public static buildStagingDirectory = 'build.stagingDirectory';
    public static buildBinariesDirectory = 'build.binariesDirectory';
    public static buildDefinitionName = 'build.definitionName';
    public static buildDefinitionVersion = 'build.definitionVersion';
    public static buildNumber = 'build.buildNumber';
    public static buildUri = 'build.buildUri';
    public static buildId = 'build.buildId';
    public static buildQueuedBy = 'build.queuedBy';
    public static buildQueuedById = 'build.queuedById';
    public static buildRequestedFor = 'build.requestedFor';
    public static buildRequestedForId = 'build.requestedForId';
    public static buildSourceVersion = 'build.sourceVersion';
    public static buildSourceBranch = 'build.sourceBranch';
    public static buildSourceBranchName = 'build.sourceBranchName';
    public static buildContainerId = 'build.containerId';
    
    //
    // Common Variables
    //       
    public static commonTestResultsDirectory = "common.testResultsDirectory";
}

export var vars = AutomationVariables;

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

export class WorkerMessageTypes {
    static Abandoned = "abandoned";
    static Job = "job";
}

//-----------------------------------------------------------
// Interfaces
//-----------------------------------------------------------

export interface IDictionary { [name: string]: any }
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
    basic: boolean;
}

// contains configuration data from server, runtime creds + settings
// this is not persisted but read from settings, server and/or user at runtime
export interface IConfiguration {
    settings: ISettings;
    poolId: number;
    createDiagnosticWriter?: () => IDiagnosticWriter;
    agent: agentifm.TaskAgent;
}

export interface IServiceChannel extends NodeJS.EventEmitter {
    agentUrl: string;
    collectionUrl: string;
    jobInfo: IJobInfo;
    enabled: boolean;

    getWebApi(): webapi.WebApi;

    // lifetime
    drain(): Q.Promise<any>;

    // queues
    queueLogPage(page: ILogPageInfo): void;
    queueConsoleLine(line: string): void;
    queueConsoleSection(line: string): void;
    createAsyncCommandQueue(serviceCtx: any): IAsyncCommandQueue;

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
    uploadFileToContainer(containerId: number, containerItemTuple: ifm.FileContainerItemInfo): Q.Promise<any>;
    postArtifact(projectId: string, buildId: number, artifact: buildifm.BuildArtifact): Q.Promise<buildifm.BuildArtifact>;

    // job
    finishJobRequest(poolId: number, lockToken: string, jobRequest: agentifm.TaskAgentJobRequest): Q.Promise<any>;

    // test publishing 
    initializeTestManagement(projectName: string): void;
    createTestRun(testRun: testifm.RunCreateModel): Q.Promise<testifm.TestRun>;
    endTestRun(testRunId: number): Q.Promise<testifm.TestRun>;
    createTestRunResult(testRunId: number, testRunResults: testifm.TestResultCreateModel[]): Q.Promise<testifm.TestCaseResult[]>;
    createTestRunAttachment(testRunId: number, fileName: string, contents: string): Q.Promise<any>;
    
    //code coverage publishing
    publishCodeCoverageSummary(coverageData: testifm.CodeCoverageData, project: string, buildId: number): Q.Promise<any>;
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

export interface IOutputChannel {
    debug(message: string): void;
    error(message: string): void;
    info(message: string): void;
    verbose(message: string): void;
    warning(message: string): void;
}

export interface IHostContext extends IOutputChannel, ITraceWriter {
    config: IConfiguration;
    workFolder: string;
}

export interface IExecutionContext extends IOutputChannel, ITraceWriter {
    recordId: string;
    
    // communication
    service: IServiceChannel;
    hostContext: IHostContext;
    authHandler: baseifm.IRequestHandler;
    getWebApi(): webapi.WebApi;
    
    // inputs
    jobInfo: IJobInfo;
    inputs: ifm.TaskInputs;
    variables: { [key: string]: string };
    taskDefinitions: { [key: string]: agentifm.TaskDefinition };
    
    // environment
    config: IConfiguration;
    traceWriter: ITraceWriter;
    workingDirectory: string;
    scmPath: string;
    debugOutput: boolean;
    
    // results
    result: agentifm.TaskResult;
    resultMessage: string;
    
    // output
    writeConsoleSection(message: string): void;
    
    // status
    setTaskStarted(name: string): void;
    setTaskResult(name: string, result: agentifm.TaskResult): void;
    registerPendingTask(id: string, name: string, order: number): void
    setJobInProgress(): void;
    finishJob(result: agentifm.TaskResult): Q.Promise<any>
}

export interface IAsyncCommand {
    command: ITaskCommand;
    description: string;
    executionContext: IExecutionContext;

    runCommandAsync(): Q.Promise<any>;
}

export interface IJobInfo {
    description: string;
    jobId: string;
    jobMessage: agentifm.JobRequestMessage;
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

export interface IScmProvider {
    hashKey: string;
    debugOutput: boolean;
    targetPath: string;
    
    // virtual - can override
    resolveInputPath(inputPath: string);
    
    // virtual - must override
    initialize();
    getCode(): Q.Promise<number>;
    clean(): Q.Promise<number>;
}

export interface IWorkerMessage {
    messageType: string;
    config: IConfiguration;
    data: any;
}

//-----------------------------------------------------------
// Helpers
//-----------------------------------------------------------

export function execAll(func: (item: any, state: any) => any, items: any[], state: any): Q.IPromise<any> {
    var initialState = state;
    var current = Q(null);

    items.forEach((item) => {
        current = current.then(function(state) {
            return func(item, state || initialState);
        });
    });

    return current;
}

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

export var MASK_REPLACEMENT: string = "********";
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
        else if (maskHint.type === agentifm.MaskType.Regex && maskHint.value) {
            maskHints.push(maskHint);
        }
    });

    if (maskHints.length > 0) {
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
            else if (maskHint.type === agentifm.MaskType.Regex) {
                indexFunctions.push((input: string) => {
                    var stubInput: string = input;
                    var results: ReplacementPosition[] = [];
                    var actualIndex = 0;
                    while (stubInput.length > 0) {
                        var match = stubInput.match(maskHint.value);
                        if (match === null) {
                            break;
                        }
                        else {
                            var matchString = match.toString();
                            results.push({ start: actualIndex + match.index, length: matchString.length });
                            stubInput = stubInput.substring(match.index + 1);
                            actualIndex = actualIndex + match.index + 1;
                        }
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

    return noReplacement;
}

//
// TODO: JobInfo is going away soon.  We should just offer the task context the full job message.
//       Until then, we're making the full job message available
//       
export function jobInfoFromJob(job: agentifm.JobRequestMessage, systemAuthHandler: baseifm.IRequestHandler): IJobInfo {
    var info: IJobInfo = {
        description: job.jobName,
        jobId: job.jobId,
        jobMessage: job,
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
