// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cm = require('./common');
import ctxm = require('./context');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import ifm = require('./api/interfaces');
import vssifm = require('vso-node-api/interfaces/common/VSSInterfaces');
import agentm = require('vso-node-api/TaskAgentApi');
import buildm = require('vso-node-api/BuildApi');
import taskm = require('vso-node-api/TaskApi');
import oldwebapim = require('./api/WebApi');
import webapim = require('vso-node-api/WebApi');
import zlib = require('zlib');
import fs = require('fs');
import tm = require('./tracing');
import cq = require('./concurrentqueue');
import Q = require('q');
import events = require('events');

var async = require('async');

var CONSOLE_DELAY = 373;
var TIMELINE_DELAY = 487;
var LOG_DELAY = 1137;
var LOCK_DELAY = 29323;
var CHECK_INTERVAL = 1000;
var MAX_DRAIN_WAIT = 60 * 1000; // 1 min

export class Events {
    static JobAbandoned = "jobAbandoned";
}

export class TimedWorker extends events.EventEmitter {
    constructor(msDelay: number) {
        super();
        this._msDelay = msDelay;
        this.enabled = true;
        this._waitAndSend();
    }

    private _msDelay: number;

    public enabled: boolean;

    //------------------------------------------------------------------
    // Work
    //------------------------------------------------------------------
    public end(): void {
        this.enabled = false;
    }

    // need to override
    public doWork(): Q.Promise<any> {
        return Q.reject(new Error('Abstract.  Must override.'));
    }

    // should likely override
    public shouldDoWork(): boolean {
        return this.enabled;
    }

    private _waitAndSend(): void {
        setTimeout(() => {
            if (this.shouldDoWork()) {
                this.doWork().fin(() => {
                    this.continueSending();
                });
            }
            else {
                this.continueSending();
            }
        }, this._msDelay);
    }

    public continueSending(): void {
        if (this.enabled) {
            this._waitAndSend();
        }
    }
}

//----------------------------------------------------------------------------------------
// Feedback Channels
// - All customer feedback funnels through this point
// - Feedback channels are pluggable for development and testing
// - The service channel is a timed worker and creates timed queues for logs and console
//----------------------------------------------------------------------------------------

var trace: tm.Tracing;

function ensureTrace(writer: cm.ITraceWriter) {
    if (!trace) {
        trace = new tm.Tracing(__filename, writer);
    }
}

export class ServiceChannel extends events.EventEmitter implements cm.IFeedbackChannel {
    constructor(agentUrl: string,
                collectionUrl: string,
                jobInfo: cm.IJobInfo,
                workerCtx: ctxm.WorkerContext) {
        super();

        ensureTrace(workerCtx);
        trace.enter('ServiceChannel');

        this.agentUrl = agentUrl;
        this.collectionUrl = collectionUrl;

        this.jobInfo = jobInfo;
        this.workerCtx = workerCtx;

        this._recordCount = 0;
        this._issues = {};

        // service apis
<<<<<<< HEAD
        this._agentApi = webapi.AgentApi(agentUrl, jobInfo.systemAuthHandler);
        this.timelineApi = webapi.TimelineApi(this.jobInfo.variables[cm.sysVars.teamProjectId], this.jobInfo.description, collectionUrl, jobInfo.systemAuthHandler);
        this._fileContainerApi = webapi.QFileContainerApi(collectionUrl, jobInfo.systemAuthHandler);
        this._buildApi = webapi.QBuildApi(collectionUrl, jobInfo.systemAuthHandler);
=======
        var webapi: webapim.WebApi = new webapim.WebApi(collectionUrl, jobInfo.systemAuthHandler);
        this._agentApi = webapi.getTaskAgentApi(agentUrl);
        this.taskApi = webapi.getTaskApi();
        this._fileContainerApi = oldwebapim.QFileContainerApi(collectionUrl, jobInfo.systemAuthHandler);
        this._buildApi = webapi.getQBuildApi();
>>>>>>> added ref to vso-node-api, converted Task, Agent, and Build

        this._totalWaitTime = 0;
        this._lockRenewer = new LockRenewer(jobInfo, workerCtx.config.poolId, this._agentApi);

        // pass the jobAbandoned event up to the owner
        this._lockRenewer.on(Events.JobAbandoned, () => {
            this.emit(Events.JobAbandoned);
        });

        // timelines
        this._timelineRecordQueue = new cq.ConcurrentBatch<agentifm.TimelineRecord>(
            (key: string) => {
                return <agentifm.TimelineRecord>{
                    id: key
                };
            },
            (values: agentifm.TimelineRecord[], callback: (err: any) => void) => {
                if (values.length === 0) {
                    callback(0);
                }
                else {
                    this.taskApi.updateRecords(
                        { value: values, count: values.length },
                        this.jobInfo.variables[cm.sysVars.teamProjectId], 
                        this.jobInfo.description, 
                        this.jobInfo.planId,
                        this.jobInfo.timelineId,
                        (err, status, records) => {
                            callback(err);
                        });
                }
            },
            (err: any) => {
                trace.write(err);
            },
            TIMELINE_DELAY);

        // console lines
        this._consoleQueue = new WebConsoleQueue(this, this.workerCtx, CONSOLE_DELAY);

        // log pages
        this._logPageQueue = new LogPageQueue(this, this.workerCtx, LOG_DELAY);

        this._timelineRecordQueue.startProcessing();
        this._consoleQueue.startProcessing();
        this._logPageQueue.startProcessing();
    }

    public enabled: boolean;
    public agentUrl: string;
    public collectionUrl: string;
    
    public workerCtx: ctxm.WorkerContext;
    public jobInfo: cm.IJobInfo;

    private _totalWaitTime: number;
    private _logQueue: LogPageQueue;
    private _lockRenewer: LockRenewer;

    private _buildApi: buildm.IQBuildApi;
    private _agentApi: agentm.ITaskAgentApi;
    private _fileContainerApi: ifm.IQFileContainerApi;
    public taskApi: taskm.ITaskApi;
    public _testApi: ifm.IQTestManagementApi;

    private _issues: any;

    private _recordCount: number;

    private _timelineRecordQueue: cq.ConcurrentBatch<agentifm.TimelineRecord>;
    private _consoleQueue: WebConsoleQueue;
    private _logPageQueue: LogPageQueue;

    // wait till all the queues are empty and not processing.
    public drain(): Q.Promise<any> {
        trace.enter('servicechannel:drain');

        var consoleFinished = this._consoleQueue.waitForEmpty();
        var logFinished = this._logPageQueue.waitForEmpty();
        var timelineFinished = this._timelineRecordQueue.waitForEmpty();

        // no more console lines or log pages should be generated
        this._consoleQueue.finishAdding();
        this._logPageQueue.finishAdding();

        // don't complete the timeline queue until the log queue is done
        logFinished.then(() => {
            this._timelineRecordQueue.finishAdding();
        });

        return Q.all([consoleFinished, logFinished, timelineFinished]);
    }

    //------------------------------------------------------------------
    // Queue Items
    //------------------------------------------------------------------  
    public queueLogPage(page: cm.ILogPageInfo): void {
        trace.enter('servicechannel:queueLogPage');
        trace.state('page', page);
        this._logPageQueue.push(page);
    }

    public queueConsoleLine(line: string): void {
        if (line.length > 512) {
            line = line.substring(0, 509) + '...';
        }
                
        trace.write('qline: ' + line);
        this._consoleQueue.push(line);
    }

    public queueConsoleSection(line: string): void {
        trace.enter('servicechannel:queueConsoleSection: ' + line);
        this._consoleQueue.section(line);
    }

    private updateJobRequest(poolId: number, lockToken: string, jobRequest: agentifm.TaskAgentJobRequest): Q.Promise<any> {
        trace.enter('servicechannel:updateJobRequest');
        trace.write('poolId: ' + poolId);
        trace.write('lockToken: ' + lockToken);
        
        var deferred = Q.defer();
        this._agentApi.updateRequest(jobRequest, poolId, jobRequest.requestId, lockToken, (err, status, jobRequest) => {
            trace.write('err: ' + err);
            trace.write('status: ' + status);
            if (status === 404) {
                // job not found, probably because the server abandoned it. stop the lock renewer
                this.emit(Events.JobAbandoned);
                this._lockRenewer.end();
            }
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(null);
            }
        });
        return deferred.promise;
    }
    
    public finishJobRequest(poolId: number, lockToken: string, jobRequest: agentifm.TaskAgentJobRequest): Q.Promise<any> {
        trace.enter('servicechannel:finishJobRequest');
        
        // end the lock renewer. if it's currently waiting on its timeout, .finished will be a previously resolved promise
        trace.write('shutting down lock renewer...');
        this._lockRenewer.end();
        
        // wait for the lock renewer to finish. this is only really meaningful if it's actually in the middle of an HTTP request
        return this._lockRenewer.finished.then(() => {
            trace.write('lock renewer shut down');
            return this.updateJobRequest(poolId, lockToken, jobRequest); 
        });
    }

    // Factory for scriptrunner to create a queue per task script execution
    // This also allows agent tests to create a queue that doesn't process to a real server (just print out work it would do)
    public createAsyncCommandQueue(taskCtx: ctxm.TaskContext): cm.IAsyncCommandQueue {
        return new AsyncCommandQueue(taskCtx, 1000);
    }

    //------------------------------------------------------------------
    // Timeline APIs
    //------------------------------------------------------------------  
    public addError(recordId: string, category: string, message: string, data: any): void {
        var current = this._getIssues(recordId);
        var record = this._getFromBatch(recordId);
        if (current.errorCount < process.env.VSO_ERROR_COUNT ? process.env.VSO_ERROR_COUNT : 10) {
            var error = <agentifm.Issue> {};
            error.category = category;
            error.type = agentifm.IssueType.Error;
            error.message = message;
            error.data = data;
            current.issues.push(error);
            record.issues = current.issues;
        }

        current.errorCount++;
        record.errorCount = current.errorCount;
    }

    public addWarning(recordId: string, category: string, message: string, data: any): void {
        var current = this._getIssues(recordId);
        var record = this._getFromBatch(recordId);
        if (current.warningCount < process.env.VSO_WARNING_COUNT ? process.env.VSO_WARNING_COUNT : 10) {
            var warning = <agentifm.Issue> {};
            warning.category = category;
            warning.type = agentifm.IssueType.Error;
            warning.message = message;
            warning.data = data;
            current.issues.push(warning);
            record.issues = current.issues;
        }

        current.warningCount++;
        record.warningCount = current.warningCount;
    }
    public setCurrentOperation(recordId: string, operation: string): void {
        trace.state('operation', operation);
        this._getFromBatch(recordId).currentOperation = operation;
    }

    public setName(recordId: string, name: string): void {
        trace.state('name', name);
        this._getFromBatch(recordId).name = name;
    }

    public setStartTime(recordId: string, startTime: Date): void {
        trace.state('startTime', startTime);
        this._getFromBatch(recordId).startTime = startTime;
    }

    public setFinishTime(recordId: string, finishTime: Date): void {
        trace.state('finishTime', finishTime);
        this._getFromBatch(recordId).finishTime = finishTime;
    }

    public setState(recordId: string, state: agentifm.TimelineRecordState): void {
        trace.state('state', state);
        this._getFromBatch(recordId).state = state;
    }

    public setResult(recordId: string, result: agentifm.TaskResult): void {
        trace.state('result', result);
        this._getFromBatch(recordId).result = result;
    }

    public setType(recordId: string, type: string): void {
        trace.state('type', type);
        this._getFromBatch(recordId).type = type;
    }

    public setParentId(recordId: string, parentId: string): void {
        trace.state('parentId', parentId);
        this._getFromBatch(recordId).parentId = parentId;
    }

    public setWorkerName(recordId: string, workerName: string): void {
        trace.state('workerName', workerName);
        this._getFromBatch(recordId).workerName = workerName;
    }

    public setLogId(recordId: string, logRef: agentifm.TaskLogReference): void {
        trace.state('logRef', logRef);
        this._getFromBatch(recordId).log = logRef;
    }

    public setOrder(recordId: string, order: number): void {
        trace.state('order', order);
        this._getFromBatch(recordId).order = order;
    }

    public uploadFileToContainer(containerId: number, containerItemTuple: ifm.ContainerItemInfo): Q.Promise<any> {
        trace.state('containerItemTuple', containerItemTuple);
        var contentStream: NodeJS.ReadableStream = fs.createReadStream(containerItemTuple.fullPath);

        return this._fileContainerApi.uploadFile(containerId,
            containerItemTuple.containerItem.path,
            contentStream,
            containerItemTuple.contentIdentifier,
            containerItemTuple.uncompressedLength,
            containerItemTuple.compressedLength,
            containerItemTuple.isGzipped);
    }  

    public postArtifact(projectId: string, buildId: number, artifact: buildifm.BuildArtifact): Q.Promise<buildifm.BuildArtifact> {
        trace.state('artifact', artifact);
        return this._buildApi.createArtifact(artifact, buildId, projectId);
    }  

    //------------------------------------------------------------------
    // Timeline internal batching
    //------------------------------------------------------------------
    private _getFromBatch(recordId: string): agentifm.TimelineRecord {
        trace.enter('servicechannel:_getFromBatch');
        return this._timelineRecordQueue.getOrAdd(recordId);
    }

    private _getIssues(recordId: string) {
        if (!this._issues.hasOwnProperty(recordId)) {
            this._issues[recordId] = { errorCount: 0, warningCount: 0, issues: [] };
        }

        return this._issues[recordId];
    }

    //------------------------------------------------------------------
    // Test publishing Items
    //------------------------------------------------------------------  
    public initializeTestManagement(projectName: string): void {
        trace.enter('servicechannel:initializeTestManagement');
        this._testApi = oldwebapim.QTestManagementApi(this.collectionUrl + "/" + projectName, this.jobInfo.systemAuthHandler);
    }

    public createTestRun(testRun: ifm.TestRun): Q.Promise<ifm.TestRun> {
        trace.enter('servicechannel:createTestRun');
        return this._testApi.createTestRun(testRun);
    }

    public endTestRun(testRunId: number) : Q.Promise<ifm.TestRun> {
        trace.enter('servicechannel:endTestRun');
        return this._testApi.endTestRun(testRunId);
    }

    public createTestRunResult(testRunId: number, testRunResults: ifm.TestRunResult[]): Q.Promise<ifm.TestRunResult[]> {
        trace.enter('servicechannel:createTestRunResult');
        return this._testApi.createTestRunResult(testRunId, testRunResults);
    }

    public createTestRunAttachment(testRunId: number, fileName: string, contents: string): Q.Promise<any> {
        trace.enter('servicechannel:createTestRunAttachment');
        return this._testApi.createTestRunAttachment(testRunId, fileName, contents);
    }
}

//------------------------------------------------------------------------------------
// Server Feedback Queues
//------------------------------------------------------------------------------------
export class BaseQueue<T> {
    private _queue: cq.ConcurrentArray<T>;
    private _ctx: ctxm.Context;
    private _msDelay: number;

    constructor(context: ctxm.Context, msDelay: number) {
        this._ctx = context;
        this._msDelay = msDelay;
    }

    public push(value: T) {
        this._queue.push(value);
    }

    public finishAdding() {
        this._queue.finishAdding();
    }

    public waitForEmpty(): Q.Promise<any> {
        return this._queue.waitForEmpty();
    }

    public startProcessing() {
        if (!this._queue) {
            this._queue = new cq.ConcurrentArray<T>(
                (values: T[], callback: (err: any) => void) => {
                    this._processQueue(values, callback);
                },
                (err: any) => {
                    this._ctx.error(err);
                },
                this._msDelay);
            this._queue.startProcessing();
        }
    }

    public _processQueue(values: T[], callback: (err: any) => void) {
        throw new Error("abstract");
    }
}

export class WebConsoleQueue extends BaseQueue<string> {
    private _jobInfo: cm.IJobInfo;
    private _taskApi: taskm.ITaskApi;

    constructor(feedback: cm.IFeedbackChannel, workerCtx: ctxm.WorkerContext, msDelay: number) {
        super(workerCtx, msDelay);
        this._jobInfo = feedback.jobInfo;
        this._taskApi = feedback.taskApi;
    }

    public section(line: string): void {
        this.push('[section] ' + this._jobInfo.mask(line));
    }

    public push(line: string): void {
        super.push(this._jobInfo.mask(line));
    }

    public _processQueue(values: string[], callback: (err: any) => void) {
        if (values.length === 0) {
            callback(null);
        }
        else {
            this._taskApi.postLines(
                { value: values, count: values.length },
                this._jobInfo.variables[cm.sysVars.teamProjectId], 
                this._jobInfo.description, 
                this._jobInfo.planId,
                this._jobInfo.timelineId,
                this._jobInfo.jobId,
                (err, status) => {
                    trace.write('done writing lines');
                    if (err) {
                        trace.write('err: ' + err.message);
                    }

                    callback(err);
                });
        }
    }
}

export class AsyncCommandQueue extends BaseQueue<cm.IAsyncCommand> implements cm.IAsyncCommandQueue {

    constructor(taskCtx: ctxm.TaskContext, msDelay: number) {
        super(taskCtx, msDelay);
        this.failed = false;
    }

    public failed: boolean;
    public errorMessage: string;
    private _service: cm.IFeedbackChannel;

    public _processQueue(commands: cm.IAsyncCommand[], callback: (err: any) => void) {
        if (commands.length === 0) {
            callback(null);
        }
        else {
            async.forEachSeries(commands, 
                (asyncCmd: cm.IAsyncCommand, done: (err: any) => void) => {

                if (this.failed) {
                    done(null);
                    return;
                }

                var outputLines = function(asyncCmd) {
                        asyncCmd.taskCtx.info(' ');
                        asyncCmd.taskCtx.info('Start: ' + asyncCmd.description);
                        asyncCmd.command.lines.forEach(function (line) {
                            asyncCmd.taskCtx.info(line);
                        });
                        asyncCmd.taskCtx.info('End: ' + asyncCmd.description);
                        asyncCmd.taskCtx.info(' ');
                }

                asyncCmd.runCommandAsync()
                .then(() => {
                    outputLines(asyncCmd);
                })
                .fail((err) => {  
                    this.failed = true;
                    this.errorMessage = err.message;
                    outputLines(asyncCmd);
                    asyncCmd.taskCtx.error(this.errorMessage);
                    asyncCmd.taskCtx.info('Failing task since command failed.')                    
                })
                .fin(function() {
                    done(null);
                })

            }, (err: any) => {
                // queue never fails - we simply don't process items once one has failed.
                callback(null);
            });
        }
    }
}

export class LogPageQueue extends BaseQueue<cm.ILogPageInfo> {
    private _recordToLogIdMap: { [recordId: string]: number } = {};
    private _jobInfo: cm.IJobInfo;
    private _taskApi: taskm.ITaskApi;
    private _workerCtx: ctxm.WorkerContext;
    private _service: cm.IFeedbackChannel;

    constructor(service: cm.IFeedbackChannel, workerCtx: ctxm.WorkerContext, msDelay: number) {
        super(workerCtx, msDelay);
        this._service = service;
        this._jobInfo = service.jobInfo;
        this._taskApi = service.taskApi;
        this._workerCtx = workerCtx;
    }

    public _processQueue(logPages: cm.ILogPageInfo[], callback: (err: any) => void): void {
        trace.enter('LogQueue:processQueue: ' + logPages.length + ' pages to process');
        if (logPages.length === 0) {
            callback(null);
        }
        else {
            for (var i = 0; i < logPages.length; i++) {
                trace.write('page: ' + logPages[i].pagePath);
            }

            var planId: string = this._jobInfo.planId;

            async.forEachSeries(logPages,
                (logPageInfo: cm.ILogPageInfo, done: (err: any) => void) => {
                    trace.state('process:logPageInfo', logPageInfo);

                    var pagePath: string = logPageInfo.pagePath;
                    trace.write('process:logPagePath: ' + pagePath);

                    var recordId: string = logPageInfo.logInfo.recordId;
                    trace.write('logRecordId: ' + recordId);

                    var serverLogPath: string;
                    var logId: number;

                    var pageUploaded = false;

                    async.series(
                        [
                            (doneStep) => {
                                trace.write('creating log record');

                                //
                                // we only want to create the log metadata record once per 
                                // timeline record Id.  So, create and put it in a map
                                //
                                if (!this._recordToLogIdMap.hasOwnProperty(logPageInfo.logInfo.recordId)) {
                                    serverLogPath = 'logs\\' + recordId; // FCS expects \
                                    this._taskApi.createLog(
                                        <agentifm.TaskLog>{ path: serverLogPath },
                                        this._jobInfo.variables[cm.sysVars.teamProjectId], 
                                        this._jobInfo.description, 
                                        planId,
                                        (err: any, statusCode: number, log: agentifm.TaskLog) => {
                                            if (err) {
                                                trace.write('error creating log record: ' + err.message);
                                                doneStep(err);
                                                return;
                                            }

                                            // associate log with timeline recordId
                                            this._recordToLogIdMap[recordId] = log.id;
                                            trace.write('added log id to map: ' + log.id);
                                            doneStep(null);
                                        });
                                }
                                else {
                                    doneStep(null);
                                }
                            },
                            (doneStep) => {
                                // check logId in map first
                                logId = this._recordToLogIdMap[recordId];
                                if (logId) {
                                    trace.write('uploading log page: ' + pagePath);
                                    fs.stat(pagePath, (err, stats) => {
                                        if (err) {
                                            trace.write('Error reading log file: ' + err.message);
                                            return;
                                        }
                                        var pageStream: NodeJS.ReadableStream = fs.createReadStream(pagePath);
                                        this._taskApi.appendLog(
                                            { "Content-Length": stats.size }, pageStream,
                                            this._jobInfo.variables[cm.sysVars.teamProjectId],
                                            this._jobInfo.description,
                                            planId,
                                            logId,
                                            (err: any, statusCode: number, obj: any) => {
                                                if (err) {
                                                    trace.write('error uploading log file: ' + err.message);
                                                }

                                                fs.unlink(pagePath, (err) => {
                                                    // we're going to continue here so we can get the next logs
                                                    // TODO: we should consider requeueing?
                                                    doneStep(null);
                                                });
                                            });
                                    });
                                }
                                else {
                                    this._workerCtx.error('Skipping log upload.  Log record does not exist.')
                                    doneStep(null);
                                }
                            },
                            (doneStep) => {
                                var logRef = <agentifm.TaskLogReference>{};
                                logRef.id = logId;
                                this._service.setLogId(recordId, logRef);
                                doneStep(null);
                            }
                        ], (err: any) => {
                            if (err) {
                                this._workerCtx.error(err.message);
                                this._workerCtx.error(JSON.stringify(logPageInfo));
                            }

                            done(err);
                        });
                },
                (err) => {
                    callback(err);
                });
        }
    }
}

// Job Renewal
export class LockRenewer extends TimedWorker {
    constructor(jobInfo: cm.IJobInfo, poolId: number, agentApi: agentm.ITaskAgentApi) {
        trace.enter('LockRenewer');

        // finished is initially a resolved promise, because a renewal is not in progress
        this.finished = Q(null);
        
        this._jobInfo = jobInfo;
        trace.state('_jobInfo', this._jobInfo);
        this._agentApi = agentApi;
        this._poolId = poolId;
        trace.write('_poolId: ' + this._poolId);

        super(LOCK_DELAY);
    }

    private _poolId: number;
    private _agentApi: agentm.ITaskAgentApi;
    private _jobInfo: cm.IJobInfo;
    
    // consumers can use this promise to wait for the lock renewal to finish
    public finished: Q.Promise<any>;

    public doWork(): Q.Promise<any> {
        return this._renewLock();
    }

    private _renewLock(): Q.Promise<any> {
        var jobRequest: agentifm.TaskAgentJobRequest = <agentifm.TaskAgentJobRequest>{};
        jobRequest.requestId = this._jobInfo.requestId;

        trace.state('jobRequest', jobRequest);
        
        // create a new, unresolved "finished" promise
        var deferred: Q.Deferred<any> = Q.defer();
        this.finished = deferred.promise;
        
        // lock token is ignored by newer servers
        this._agentApi.updateRequest(jobRequest, this._poolId, jobRequest.requestId, this._jobInfo.lockToken, (err, status, jobRequest) => {
            if (status === 404) {
                // job not found. stop this loop.
                this.emit(Events.JobAbandoned);
                this.end();
            }
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(null);
            }
        });
        
        return deferred.promise;
    }
}
