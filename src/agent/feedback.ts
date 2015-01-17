// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cm = require('./common');
import ctxm = require('./context');
import ifm = require('./api/interfaces');
import webapi = require('./api/webapi');
import basicm = require('./api/basiccreds');
import zlib = require('zlib');
import fs = require('fs');
import tm = require('./tracing');
import cq = require('./concurrentqueue');
import Q = require('q');

var async = require('async');

var CONSOLE_DELAY = 373;
var TIMELINE_DELAY = 487;
var LOG_DELAY = 1137;
var LOCK_DELAY = 29323;
var CHECK_INTERVAL = 1000;
var MAX_DRAIN_WAIT = 60 * 1000; // 1 min

export class TimedWorker {
    constructor(msDelay: number) {
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
    public doWork(callback: (err: any) => void): void {
        throw new Error('Abstract.  Must override.')
        callback(null);
    }

    // should likely override
    public shouldDoWork(): boolean {
        return this.enabled;
    }

    private _waitAndSend(): void {
        setTimeout(() => {
            if (this.shouldDoWork()) {
                this.doWork((err) => {
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

export class ServiceChannel implements cm.IFeedbackChannel {
    constructor(agentUrl: string,
                collectionUrl: string,
                jobInfo: cm.IJobInfo,
                agentCtx: ctxm.AgentContext) {

        ensureTrace(agentCtx);
        trace.enter('ServiceChannel');

        this.agentUrl = agentUrl;
        this.collectionUrl = collectionUrl;

        this.jobInfo = jobInfo;
        this.agentCtx = agentCtx;

        this._recordCount = 0;
        this._issues = {};

        // service apis
        this._agentApi = webapi.AgentApi(agentUrl, cm.basicHandlerFromCreds(agentCtx.config.creds));
        this.timelineApi = webapi.TimelineApi(collectionUrl, cm.basicHandlerFromCreds(agentCtx.config.creds));
        this._fileContainerApi = webapi.QFileContainerApi(collectionUrl, cm.basicHandlerFromCreds(agentCtx.config.creds));
        this._buildApi = webapi.QBuildApi(collectionUrl, cm.basicHandlerFromCreds(agentCtx.config.creds));

        this._totalWaitTime = 0;
        this._lockRenewer = new LockRenewer(jobInfo, agentCtx.config.poolId, this._agentApi);

        // timelines
        this._timelineRecordQueue = new cq.ConcurrentBatch<ifm.TimelineRecord>(
            (key: string) => {
                return <ifm.TimelineRecord>{
                    id: key
                };
            },
            (values: ifm.TimelineRecord[], callback: (err: any) => void) => {
                if (values.length === 0) {
                    callback(0);
                }
                else {
                    this.timelineApi.updateTimelineRecords(this.jobInfo.planId,
                        this.jobInfo.timelineId, values,
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
        this._consoleQueue = new WebConsoleQueue(this, this.agentCtx, CONSOLE_DELAY);

        // log pages
        this._logPageQueue = new LogPageQueue(this, this.agentCtx, LOG_DELAY);

        this._timelineRecordQueue.startProcessing();
        this._consoleQueue.startProcessing();
        this._logPageQueue.startProcessing();
    }

    public enabled: boolean;
    public agentUrl: string;
    public collectionUrl: string;
    
    public agentCtx: ctxm.AgentContext;
    public jobInfo: cm.IJobInfo;

    private _totalWaitTime: number;
    private _logQueue: LogPageQueue;
    private _lockRenewer: LockRenewer;

    private _buildApi: ifm.IQBuildApi;
    private _agentApi: ifm.IAgentApi;
    private _fileContainerApi: ifm.IQFileContainerApi;
    public timelineApi: ifm.ITimelineApi;

    private _issues: any;

    private _recordCount: number;

    private _timelineRecordQueue: cq.ConcurrentBatch<ifm.TimelineRecord>;
    private _consoleQueue: WebConsoleQueue;
    private _logPageQueue: LogPageQueue;

    // wait till all the queues are empty and not processing.
    public drain(callback: (err: any) => void): void {
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

        Q.all([consoleFinished, logFinished, timelineFinished])
            .fail((err: any) => {
                callback(err);
            })
            .then((results: any) => {
                callback(null);
            });
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
        trace.write('qline: ' + line);
        this._consoleQueue.push(line);
    }

    public queueConsoleSection(line: string): void {
        trace.enter('servicechannel:queueConsoleSection: ' + line);
        this._consoleQueue.section(line);
    }

    public updateJobRequest(poolId: number, lockToken: string, jobRequest: ifm.TaskAgentJobRequest, callback: (err: any) => void): void {
        trace.enter('servicechannel:updateJobRequest');
        trace.write('poolId: ' + poolId);
        trace.write('lockToken: ' + lockToken);
        this._agentApi.updateJobRequest(poolId, lockToken, jobRequest, (err, status, jobRequest) => {
            trace.write('err: ' + err);
            trace.write('status: ' + status);
            callback(err);
        });
    }

    //------------------------------------------------------------------
    // Timeline APIs
    //------------------------------------------------------------------  
    public addError(recordId: string, category: string, message: string, data: any): void {
        var current = this._getIssues(recordId);
        var record = this._getFromBatch(recordId);
        if (current.errorCount < process.env.VSO_ERROR_COUNT ? process.env.VSO_ERROR_COUNT : 10) {
            var error = <ifm.TaskIssue> {};
            error.category = category;
            error.issueType = ifm.TaskIssueType.Error;
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
            var warning = <ifm.TaskIssue> {};
            warning.category = category;
            warning.issueType = ifm.TaskIssueType.Error;
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

    public setState(recordId: string, state: ifm.TimelineRecordState): void {
        trace.state('state', state);
        this._getFromBatch(recordId).state = state;
    }

    public setResult(recordId: string, result: ifm.TaskResult): void {
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

    public setLogId(recordId: string, logRef: ifm.TaskLogReference): void {
        trace.state('logRef', logRef);
        this._getFromBatch(recordId).log = logRef;
    }

    public setOrder(recordId: string, order: number): void {
        trace.state('order', order);
        this._getFromBatch(recordId).order = order;
    }

    public uploadFileToContainer(containerId: number, containerItemTuple: ifm.ContainerItemInfo): Q.IPromise<any> {
        trace.state('containerItemTuple', containerItemTuple);
        var contentStream: NodeJS.ReadableStream;
        if (containerItemTuple.isGzipped) {
            var gzip = zlib.createGzip();
            var inputStream = fs.createReadStream(containerItemTuple.fullPath);            
            contentStream = inputStream.pipe(gzip);
        }
        else {
            contentStream = fs.createReadStream(containerItemTuple.fullPath);
        }

        return this._fileContainerApi.uploadFile(containerId,
            containerItemTuple.containerItem.path,
            contentStream,
            containerItemTuple.contentIdentifier,
            containerItemTuple.uncompressedLength,
            containerItemTuple.compressedLength,
            containerItemTuple.isGzipped);
    }  

    public postArtifact(buildId: number, artifact: ifm.BuildArtifact): Q.IPromise<ifm.BuildArtifact> {
        trace.state('artifact', artifact);
        return this._buildApi.postArtifact(buildId, artifact);
    }  

    //------------------------------------------------------------------
    // Timeline internal batching
    //------------------------------------------------------------------
    private _getFromBatch(recordId: string): ifm.TimelineRecord {
        trace.enter('servicechannel:_getFromBatch');
        return this._timelineRecordQueue.getOrAdd(recordId);
    }

    private _getIssues(recordId: string) {
        if (!this._issues.hasOwnProperty(recordId)) {
            this._issues[recordId] = { errorCount: 0, warningCount: 0, issues: [] };
        }

        return this._issues[recordId];
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
    private _timelineApi: ifm.ITimelineApi;

    constructor(feedback: cm.IFeedbackChannel, agentCtx: ctxm.AgentContext, msDelay: number) {
        super(agentCtx, msDelay);
        this._jobInfo = feedback.jobInfo;
        this._timelineApi = feedback.timelineApi;
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
            this._timelineApi.appendTimelineRecordFeed(this._jobInfo.planId,
                this._jobInfo.timelineId,
                this._jobInfo.jobId,
                values,
                (err, status, lines) => {
                    trace.write('done writing lines');
                    if (err) {
                        trace.write('err: ' + err.message);
                    }

                    callback(err);
                });
        }
    }
}

export class LogPageQueue extends BaseQueue<cm.ILogPageInfo> {
    private _recordToLogIdMap: { [recordId: string]: number } = {};
    private _jobInfo: cm.IJobInfo;
    private _timelineApi: ifm.ITimelineApi;
    private _agentCtx: ctxm.AgentContext;
    private _feedback: cm.IFeedbackChannel;

    constructor(feedback: cm.IFeedbackChannel, agentCtx: ctxm.AgentContext, msDelay: number) {
        super(agentCtx, msDelay);
        this._feedback = feedback;
        this._jobInfo = feedback.jobInfo;
        this._timelineApi = feedback.timelineApi;
        this._agentCtx = agentCtx;
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
                                    this._timelineApi.createLog(planId,
                                        serverLogPath,
                                        (err: any, statusCode: number, log: ifm.TaskLog) => {
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
                                    this._timelineApi.uploadLogFile(planId,
                                        logId,
                                        pagePath,
                                        (err: any, statusCode: number, obj: any) => {
                                            if (err) {
                                                trace.write('error uploading log file: ' + err.message);
                                            }

                                            // we're going to continue here so we can get the next logs
                                            // TODO: we should consider requeueing?
                                            doneStep(null);
                                        });
                                }
                                else {
                                    this._agentCtx.error('Skipping log upload.  Log record does not exist.')
                                    doneStep(null);
                                }
                            },
                            (doneStep) => {
                                var logRef = <ifm.TaskLogReference>{};
                                logRef.id = logId;
                                this._feedback.setLogId(recordId, logRef);
                                doneStep(null);
                            }
                        ], (err: any) => {
                            if (err) {
                                this._agentCtx.error(err.message);
                                this._agentCtx.error(JSON.stringify(logPageInfo));
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
    constructor(jobInfo: cm.IJobInfo, poolId: number, agentApi: ifm.IAgentApi) {
        trace.enter('LockRenewer');

        this._jobInfo = jobInfo;
        trace.state('_jobInfo', this._jobInfo);
        this._agentApi = agentApi;
        this._poolId = poolId;
        trace.write('_poolId: ' + this._poolId);

        super(LOCK_DELAY);
    }

    private _poolId: number;
    private _agentApi: ifm.IAgentApi;
    private _jobInfo: cm.IJobInfo;

    public doWork(callback: (err: any) => void): void {
        this._renewLock(callback);
    }

    public stop() {
        this.enabled = false;
    }

    private _renewLock(callback: (err: any) => void): void {
        var jobRequest: ifm.TaskAgentJobRequest = <ifm.TaskAgentJobRequest>{};
        jobRequest.requestId = this._jobInfo.requestId;

        trace.state('jobRequest', jobRequest);
        this._agentApi.updateJobRequest(this._poolId, this._jobInfo.lockToken, jobRequest, (err, status, jobRequest) => {
            callback(err);
        });
    }
}



