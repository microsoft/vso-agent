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

export class TimedQueue extends TimedWorker{
    constructor(msDelay: number) {
        this._queue = [];
        this.isProcessing = false;
        super(msDelay);
    }

    public _queue: any[];
    public isProcessing: boolean;

    //------------------------------------------------------------------
    // Queueing
    //------------------------------------------------------------------
    public add(item: any): void {
        this._queue.push(item);
    }

    public getLength(): number {
        return this._queue.length;
    }
 
    //------------------------------------------------------------------
    // Sending
    //------------------------------------------------------------------

    // need to override
    public processQueue(queue: any[], callback: (err: any) => void): void {
        callback(null);
    }

    //------------------------------------------------------------------
    // Overrides
    //------------------------------------------------------------------
    public doWork(callback: (err: any) => void): void {
        var toSend = this._queue;
        this._queue = [];
        this.isProcessing = true;
        this.processQueue(toSend, (err) => {
            this.isProcessing = false;
            this.continueSending();
        });
    }

    public shouldDoWork(): boolean {
        return this._queue.length > 0;
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

export class ServiceChannel extends TimedWorker implements cm.IFeedbackChannel {
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


        // timelines
        this._batch = {};
        this._recordCount = 0;
        this._issues = {};

        // service apis
        this._agentApi = webapi.AgentApi(agentUrl, cm.basicHandlerFromCreds(agentCtx.config.creds));
        this.timelineApi = webapi.TimelineApi(collectionUrl, cm.basicHandlerFromCreds(agentCtx.config.creds));
        this._fileContainerApi = webapi.QFileContainerApi(collectionUrl, cm.basicHandlerFromCreds(agentCtx.config.creds));
        this._buildApi = webapi.QBuildApi(collectionUrl, cm.basicHandlerFromCreds(agentCtx.config.creds));

        this._totalWaitTime = 0;
        this._logQueue = new LogPageQueue(this, agentCtx);
        this._consoleQueue = new WebConsoleQueue(this);
        this._lockRenewer = new LockRenewer(jobInfo, agentCtx.config.poolId, this._agentApi);       

        super(TIMELINE_DELAY);
    }

    public agentUrl: string;
    public collectionUrl: string;
    
    public agentCtx: ctxm.AgentContext;
    public jobInfo: cm.IJobInfo;

    private _totalWaitTime: number;
    private _logQueue: LogPageQueue;
    private _consoleQueue: WebConsoleQueue;
    private _lockRenewer: LockRenewer;

    private _buildApi: ifm.IQBuildApi;
    private _agentApi: ifm.IAgentApi;
    private _fileContainerApi: ifm.IQFileContainerApi;
    public timelineApi: ifm.ITimelineApi;

    private _issues: any;

    private _batch: any;
    private _recordCount: number;

    // wait till all the queues are empty and not processing.
    public drain(callback: (err: any) => void): void {
        trace.enter('servicechannel:drain');
        //this._lockRenewer.stop();
        this._waitOnProcessing(callback);
    }

    private _queuesBusy(): boolean {
        trace.write('console queue : ' + this._consoleQueue.isProcessing + ' ' + this._consoleQueue.getLength());
        trace.write('log queue     : ' + this._logQueue.isProcessing + ' ' + this._logQueue.getLength());

        var busy = (this._consoleQueue.isProcessing || this._consoleQueue.getLength() > 0) ||
                   (this._logQueue.isProcessing || this._logQueue.getLength() > 0);

        trace.write('busy: ' + busy);
        return busy;
    }

    private _waitOnProcessing(callback: (err: any) => void): void {
        trace.write('Waiting on processing: ' + this._totalWaitTime / 1000 + ' sec');
        setTimeout(() => {
            this._totalWaitTime += CHECK_INTERVAL;
            if (this._queuesBusy() && this._totalWaitTime <= MAX_DRAIN_WAIT) {
                trace.write('continue waiting');
                this._waitOnProcessing(callback);
            }
            else {
                callback(null);
            }
        }, CHECK_INTERVAL);
    }   

    //------------------------------------------------------------------
    // Queue Items
    //------------------------------------------------------------------  
    public queueLogPage(page: cm.ILogPageInfo): void {
        trace.enter('servicechannel:queueLogPage');
        trace.state('page', page);
        this._logQueue.add(page);
    }

    public queueConsoleLine(line: string): void {
        trace.write('qline: ' + line);
        this._consoleQueue.add(line);
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
        // only add errors to existing records (registered tasks ...)
        if (!this._recordExists(recordId)){
            return;
        }

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
        // only add warnings to existing records (registered tasks ...)
        if (!this._recordExists(recordId)){
            return;
        }

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
        this._getFromBatch(recordId).currentOperation = operation;
    }

    public setName(recordId: string, name: string): void {
        this._getFromBatch(recordId).name = name;
    }

    public setStartTime(recordId: string, startTime: Date): void {
        this._getFromBatch(recordId).startTime = startTime;
    }

    public setFinishTime(recordId: string, finishTime: Date): void {
        this._getFromBatch(recordId).finishTime = finishTime;
    }

    public setState(recordId: string, state: ifm.TimelineRecordState): void {
        this._getFromBatch(recordId).state = state;
    }

    public setResult(recordId: string, result: ifm.TaskResult): void {
        this._getFromBatch(recordId).result = result;
    }

    public setType(recordId: string, type: string): void {
        this._getFromBatch(recordId).type = type;
    }

    public setParentId(recordId: string, parentId: string): void {
        this._getFromBatch(recordId).parentId = parentId;
    }

    public setWorkerName(recordId: string, workerName: string): void {
        this._getFromBatch(recordId).workerName = workerName;
    }

    public setLogId(recordId: string, logRef: ifm.TaskLogReference): void {
        this._getFromBatch(recordId).log = logRef;
    }

    public setOrder(recordId: string, order: number): void {
        this._getFromBatch(recordId).order = order;
    }

    public uploadFileToContainer(containerId: number, containerItemTuple: ifm.ContainerItemInfo): Q.IPromise<any> {
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
        return this._buildApi.postArtifact(buildId, artifact);
    }  

    //------------------------------------------------------------------
    // Timeline internal batching
    //------------------------------------------------------------------
    
    public doWork(callback: (err: any) => void): void {
        trace.enter('servicechannel:doWork');
        var records: ifm.TimelineRecord[] = this._recordsFromBatch();
        trace.write('record count: ' + records.length);

        this._batch = {};
        this._recordCount = 0;      
        this._sendTimelineRecords(records, callback);
    }

    
    public shouldDoWork(): boolean {
        trace.enter('servicechannel:shouldDoWork');
        return this._recordCount > 0;
    }

    private _recordExists(recordId: string) {
        return this._batch.hasOwnProperty(recordId);
    }

    private _getFromBatch(recordId: string) {
        trace.enter('servicechannel:_getFromBatch');
        if (!this._batch.hasOwnProperty(recordId)) {
            this._batch[recordId] = {};
            ++this._recordCount;
        }

        return this._batch[recordId];
    }

    private _getIssues(recordId: string) {
        if (!this._issues.hasOwnProperty(recordId)) {
            this._issues[recordId] = {errorCount: 0, warningCount: 0, issues: []};
        }

        return this._issues[recordId];
    }

    private _sendTimelineRecords(records: ifm.TimelineRecord[], callback: (err: any) => void): void {
        trace.enter('servicechannel:_sendTimelineRecords');
        trace.state('records', records);

        this.timelineApi.updateTimelineRecords(this.jobInfo.planId, 
                                           this.jobInfo.timelineId, records, 
                                           (err, status, records) => {
                                                callback(err);
                                           });

    }

    private _recordsFromBatch(): ifm.TimelineRecord[] {
        trace.enter('servicechannel:_recordsFromBatch');
        var records: ifm.TimelineRecord[] = [];
        
        for (var id in this._batch) {
            var record: ifm.TimelineRecord = <ifm.TimelineRecord>this._batch[id];
            record.id = id;
            records.push(record);
        }

        return records;
    }   
}

//------------------------------------------------------------------------------------
// Server Feedback Queues
//------------------------------------------------------------------------------------
export class WebConsoleQueue extends TimedQueue {
    constructor(feedback: cm.IFeedbackChannel) {
        this._jobInfo = feedback.jobInfo;
        this._timelineApi = feedback.timelineApi;
        super(CONSOLE_DELAY);
    }

    public section(line: string): void {
        this.add('[section] ' + line);
    }

    private _jobInfo: cm.IJobInfo;
    private _timelineApi: ifm.ITimelineApi;

    public processQueue(queue: any[], callback: (err: any) => void): void {
        trace.state('queue', queue);
        trace.state('jobInfo', this._jobInfo);
        this._timelineApi.appendTimelineRecordFeed(this._jobInfo.planId, 
                                              this._jobInfo.timelineId, 
                                              this._jobInfo.jobId, 
                                              queue, 
                                              (err, status, lines) => {
                                                trace.write('done writing lines');
                                                if (err) {
                                                    trace.write('err: ' + err.message);
                                                }

                                                callback(err);
                                              });   
    }
}

export class LogPageQueue extends TimedQueue {
    constructor(feedback: cm.IFeedbackChannel, agentCtx: ctxm.AgentContext) {
        ensureTrace(agentCtx);
        trace.enter('LogPageQueue');

        this._feedback = feedback;
        this._jobInfo = feedback.jobInfo;
        this._timelineApi = feedback.timelineApi;
        this._agentCtx = agentCtx;
        this._recordToLogIdMap = {};

        super(LOG_DELAY);
    }

    private _feedback: cm.IFeedbackChannel;
    private _trace: tm.Tracing;
    private _agentCtx: ctxm.AgentContext;
    private _jobInfo: cm.IJobInfo;
    private _timelineApi: ifm.ITimelineApi;

    //
    // TODO: delete the file after uploading.  should probably leave on disk and wait for clean up procedure
    //
    private _recordToLogIdMap: { [recordId: string]: number };

    public processQueue(queue: any[], callback: (err: any) => void): void {
        trace.enter('LogQueue:processQueue: ' + queue.length + ' pages to process');
        for (var i=0; i < queue.length; i++) {
            trace.write('page: ' + queue[i].pagePath);
        }
        
        var planId: string = this._jobInfo.planId;

        async.forEachSeries(queue,
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

                        //
                        // The timeline channel drains and shutdowns when job ends.
                        // Logs might still be uploading after job completes.
                        // So, if disabled, do a final drain of the timeline records (contains ptrs to log)
                        //
                        if (!this._feedback.enabled) {
                            trace.write('feedback disabled: draining queue');
                            this._feedback.drain((err: any) => {
                                if (err) {
                                    trace.write('error draining queue: ' + err.message);
                                }

                                // we're going to continue here so we can get the next logs
                                // TODO: we should consider requeueing?
                                doneStep(null);
                            });
                        }
                        else {
                            doneStep(null);
                        }
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



