// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

import cm = require('./common');
import ctxm = require('./context');
import ifm = require('./api/interfaces');
import tm = require('./tracing');

var async = require('async');

var CONSOLE_DELAY = 373;
var TIMELINE_DELAY = 487;
var LOG_DELAY = 1137;
var LOCK_DELAY = 29323;
var CHECK_INTERVAL = 1000;
var MAX_DRAIN_WAIT = 10 * 60 * 1000; // 10 min

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
		this._isProcessing = false;
		this._totalWaitTime = 0;
		super(msDelay);
	}

	public _queue: any[];
    private _isProcessing: boolean;
    private _totalWaitTime: number;

    //------------------------------------------------------------------
	// Queueing
	//------------------------------------------------------------------
	public add(item: any): void {
		this._queue.push(item);
	}
 
    //------------------------------------------------------------------
	// Sending
	//------------------------------------------------------------------
	public drain(callback: (err: any) => void): void {
		trace.enter('queue:drain');
		this.enabled = false;
		
		if (this._queue && this._queue.length > 0) {
			trace.write('queue items to process: ' + this._queue.length);
			var toSend = this._queue;
			this._queue = [];
			this._isProcessing = true;
			this.processQueue(toSend, (err) => {
				trace.write('queue done processing');
				this._isProcessing = false;
				callback(err);
			});
		}
		else {
			//
			// If the queue is empty, it's possible it's still processing. 
			// Before we callback that we've completely drained, let's
			// wait for processing up to some max drain time.
			//
            if (this._isProcessing) {
            	trace.write('waiting on processing');
                this._totalWaitTime = 0;
                this._waitOnProcessing(callback);                
            }
            else {
                callback(null);
            }
		}
	}

    private _waitOnProcessing(callback: (err: any) => void): void {
    	trace.write('Waiting on processing: ' + this._totalWaitTime / 1000 + 'sec');
    	setTimeout(() => {
    		this._totalWaitTime += CHECK_INTERVAL;
    		if (!this._isProcessing || this._totalWaitTime >= MAX_DRAIN_WAIT) {
    			trace.write('processing: ' + this._isProcessing);
    			callback(null);
    		}
    		else {
    			this._waitOnProcessing(callback);
    		}
    	}, CHECK_INTERVAL);
    }

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
		this._isProcessing = true;
		this.processQueue(toSend, (err) => {
			this._isProcessing = false;
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
		        taskUrl: string, 
		        jobInfo: cm.IJobInfo, 
		        agentCtx: ctxm.AgentContext) {

		ensureTrace(agentCtx);
		trace.enter('ServiceChannel');

		this.agentUrl = agentUrl;
		this.taskUrl = taskUrl;

		this.jobInfo = jobInfo;
		this.agentCtx = agentCtx;


		// timelines
		this._batch = {};
		this._recordCount = 0;

		// service apis
		this._agentApi = cm.createAgentApi(agentUrl, 
                                        agentCtx.config.creds.username, 
                                        agentCtx.config.creds.password);

		this.taskApi = cm.createTaskApi(taskUrl, 
                                        agentCtx.config.creds.username, 
                                        agentCtx.config.creds.password);

		this._logQueue = new LogPageQueue(this, agentCtx);
		this._consoleQueue = new WebConsoleQueue(this);
		this._lockRenewer = new LockRenewer(jobInfo, agentCtx.config.poolId, this._agentApi);		

        super(TIMELINE_DELAY);
	}

	public agentUrl: string;
	public taskUrl: string;
	public taskApi: ifm.ITaskApi;
	public agentCtx: ctxm.AgentContext;
	public jobInfo: cm.IJobInfo;
	public enabled: boolean;

	private _logQueue: LogPageQueue;
	private _consoleQueue: WebConsoleQueue;
	private _lockRenewer: LockRenewer;

	private _agentApi: ifm.IAgentApi;
	

	private _batch: any;
	private _recordCount: number;

	// finish sending feedback before finishing job
	public drain(callback: (err: any) => void): void {
		trace.enter('servicechannel:drain');
		this.enabled = false;
		this._consoleQueue.end();

		// drain the timeline batch
		this.doWork((err: any) => {
			trace.write('done work');
			if (err) {
				// TODO: failure case ... more?
				trace.write('error draining queue: ' + err.message);
			}

			trace.write('draining console queue ...');
			this._consoleQueue.drain(callback);
		});
	}

	// work after job completed (uploading logs)
	public finish(callback: (err: any) => void): void {	
		trace.enter('servicechannel:finish');
		this._lockRenewer.stop();
		this._logQueue.drain(callback);
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

	private _getFromBatch(recordId: string) {
		trace.enter('servicechannel:_getFromBatch');
		if (!this._batch.hasOwnProperty(recordId)) {
			this._batch[recordId] = {};
			++this._recordCount;
		}

		return this._batch[recordId];
	}  	

	private _sendTimelineRecords(records: ifm.TimelineRecord[], callback: (err: any) => void): void {
		trace.enter('servicechannel:_sendTimelineRecords');
		trace.state('records', records);

    	this.taskApi.updateTimelineRecords(this.jobInfo.planId, 
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
		this._taskApi = feedback.taskApi;
		super(CONSOLE_DELAY);
	}

	public section(line: string): void {
		this.add('[section] ' + line);
	}

	private _jobInfo: cm.IJobInfo;
	private _taskApi: ifm.ITaskApi;

	public processQueue(queue: any[], callback: (err: any) => void): void {
		trace.state('queue', queue);
		trace.state('jobInfo', this._jobInfo);
    	this._taskApi.appendTimelineRecordFeed(this._jobInfo.planId, 
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
		this._taskApi = feedback.taskApi;
		this._agentCtx = agentCtx;
		this._recordToLogIdMap = {};

		super(LOG_DELAY);
	}

	private _feedback: cm.IFeedbackChannel;
	private _trace: tm.Tracing;
	private _agentCtx: ctxm.AgentContext;
	private _jobInfo: cm.IJobInfo;
	private _taskApi: ifm.ITaskApi;

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
    						this._taskApi.createLog(planId, 
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
							this._taskApi.uploadLogFile(planId, 
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



