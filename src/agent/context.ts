// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cfgm = require('./configuration');
import cm = require('./common');
import dm = require('./diagnostics');
import events = require('events');
import fm = require('feedback');
import fs = require('fs');
import ifm = require('./api/interfaces');
import lm = require('./logging');
import os = require("os");
import path = require('path');
import tm = require('./tracing');
import um = require('./utilities');

var trace: tm.Tracing;

function ensureTrace(writer: cm.ITraceWriter) {
    if (!trace) {
        trace = new tm.Tracing(__filename, writer);
    }
}

export class WellKnownVariables {
    public static sourceFolder = "build.sourceDirectory";
    public static stagingFolder = "build.stagingdirectory";
    public static buildId = "build.buildId";
}

export class Context extends events.EventEmitter {
    constructor(writers: cm.IDiagnosticWriter[]) {
        super();
        this.writers = writers;
        this.hasErrors = false;
    }

    public config: cm.IConfiguration;
    public hasErrors: boolean;
    private writers: cm.IDiagnosticWriter[];

    // TODO: parse line to direct appropriately
    public output(line: string) {
        this.writers.forEach((writer) => {
            writer.write(line);
        });
    }

    public error(message: string) {
        this.hasErrors = true;

        // in case some js task/plugins end up passing through an Error object.
        var obj = <any>message;
        if (typeof (message) === 'object' && obj.hasOwnProperty('message')) { 
            message = obj.message;
        }

        this._write(cm.DiagnosticLevel.Error, 'Error', message);
    }

    public warning(message: string) {
        this._write(cm.DiagnosticLevel.Warning, 'Warning', message);
    }

    public info(message: string) {
        this._write(cm.DiagnosticLevel.Info, null, message);
    }

    public verbose(message: string) {
        this._write(cm.DiagnosticLevel.Verbose, null, message);
    }

    private _write(level: cm.DiagnosticLevel, tag: string, message: string) {
        if (typeof (message) !== 'string') {
            trace.error('invalid message type: ' + typeof (message));
            return;
        }

        var lines = message.split(os.EOL);

        for (var i in lines) {
            var line = lines[i].replace(/(\r\n|\n|\r)/gm, '');

            var prefix = tag ? '[' + tag + '] ' : '';
            var dateTime = new Date().toISOString() + ': ';

            var logLine = prefix + dateTime + line + os.EOL;

            var hasWritten = false;
            this.writers.forEach((writer) => {
                if (writer.level >= level) {
                    hasWritten = true;
                    if (level == cm.DiagnosticLevel.Error) {
                        writer.writeError(logLine);
                    }
                    else {
                        writer.write(logLine);
                    }
                }
            });

            if (hasWritten) {
                this.emit('message', prefix + line);    
            }
        }
    }

    public heading(message: string) {
        this.writers.forEach((writer) => {

            if (writer.level >= cm.DiagnosticLevel.Status) {
                var delim = '----------------------------------------------------------------------' + os.EOL;
                this._write(cm.DiagnosticLevel.Info, null, delim + message + delim);
            }
        });
    }

    public status(message: string) {
        this._write(cm.DiagnosticLevel.Status, null, message);
    }

    public section(message: string) {
        this.writers.forEach((writer) => {
            if (writer.level >= cm.DiagnosticLevel.Status) {
                this._write(cm.DiagnosticLevel.Info, null, ' ' + os.EOL + '+++++++' + message + ' ' + os.EOL);
            }
        });
    }

    public end(): void {
        this.writers.forEach((writer) => {
            writer.end();
        });
    }
}

export class AgentContext extends Context implements cm.ITraceWriter {
    constructor(config: cm.IConfiguration, consoleOutput: boolean) {
        ensureTrace(this);
        this.config = config;

        var rootAgentDir = path.join(__dirname, '..');

        // Set full path for work folder, as it is used by others - config can have a relative path (./work)
        this.diagFolder = path.join(rootAgentDir, '_diag');
        
        this.fileWriter = new dm.DiagnosticFileWriter(process.env[cm.envVerbose] ? cm.DiagnosticLevel.Verbose : cm.DiagnosticLevel.Info,
            this.diagFolder,
            new Date().toISOString().replace(/:/gi, '_') + '_' + process.pid + '.log');

        var writers: cm.IDiagnosticWriter[] = [this.fileWriter];

        if (consoleOutput) {
            writers.push(new dm.DiagnosticConsoleWriter(cm.DiagnosticLevel.Status));
        }
        
        super(writers);
    }

    public diagFolder: string;
    private fileWriter: cm.IDiagnosticWriter;

    // ITraceWriter
    public trace(message: string) {
        this.fileWriter.write(message);
    }
}

export class WorkerContext extends Context implements cm.ITraceWriter {
    constructor(config: cm.IConfiguration, consoleOutput: boolean) {
        
        this.config = config;

        var rootAgentDir = path.join(__dirname, '..');

        ensureTrace(this);

        // Set full path for work folder, as it is used by others - config can have a relative path (./work)
        this.workFolder = cm.getWorkPath(config); 
        this.config.settings.workFolder = this.workFolder;
        this.diagFolder = cm.getWorkerDiagPath(config);
        
        this.fileWriter = new dm.DiagnosticFileWriter(process.env[cm.envVerbose] ? cm.DiagnosticLevel.Verbose : cm.DiagnosticLevel.Info,
            this.diagFolder,
            new Date().toISOString().replace(/:/gi, '_') + '_' + process.pid + '.log');

        var writers: cm.IDiagnosticWriter[] = [this.fileWriter];

        if (consoleOutput) {
            writers.push(new dm.DiagnosticConsoleWriter(cm.DiagnosticLevel.Status));
        }
        
        super(writers);
    }

    public service: cm.IFeedbackChannel;
    public workFolder: string;
    public diagFolder: string;
    private fileWriter: cm.IDiagnosticWriter;

    // ITraceWriter
    public trace(message: string) {
        this.fileWriter.write(message);
    }
}

export class ExecutionContext extends Context {
    constructor(jobInfo: cm.IJobInfo,
        recordId: string,
        service: cm.IFeedbackChannel,
        workerCtx: WorkerContext) {

        ensureTrace(workerCtx);
        trace.enter('ExecutionContext');

        this.jobInfo = jobInfo;
        this.variables = jobInfo.variables;
        this.recordId = recordId;
        this.workerCtx = workerCtx;
        this.service = service;
        this.config = workerCtx.config;

        this.buildDirectory = this.variables[cm.agentVars.buildDirectory];
        this.workingDirectory = this.variables[cm.agentVars.workingDirectory];
        var logFolder = path.join(this.workingDirectory, '_logs');

        var logData = <cm.ILogMetadata>{};
        logData.jobInfo = jobInfo;
        logData.recordId = recordId;

        var logger: lm.PagingLogger = new lm.PagingLogger(logFolder, logData);
        logger.level = this.variables[cm.sysVars.debug] == 'true' ? cm.DiagnosticLevel.Verbose : cm.DiagnosticLevel.Info;

        logger.on('pageComplete', (info: cm.ILogPageInfo) => {
            trace.state('pageComplete', info);
            service.queueLogPage(info);
        });

        this.util = new um.Utilities(this);

        super([logger]);
    }

    public workerCtx: WorkerContext;
    public jobInfo: cm.IJobInfo;
    public variables: { [key: string]: string };
    public recordId: string;
    public buildDirectory: string;
    public workingDirectory: string;
    public service: cm.IFeedbackChannel;
    public util: um.Utilities;

    public error(message: string): void {
        this.service.addError(this.recordId, "Console", message, null);
        super.error(message);
    }

    public warning(message: string): void {
        this.service.addWarning(this.recordId, "Console", message, null);
        super.warning(message);
    }
}


//=================================================================================================
//
// JobContext 
//
//  - used by the infrastructure during the workers executions of a job
//  - has full access to the full job data including credentials etc...
//  - Job is renewed every minute
//
//  - Feedback
//    - PRINCIPLE: by lazy - only send/create if there's data to be written
//    - logs are sent up latent in pages (even fine if continues after job is complete)
//    - Live Web Console Feed lines are sent on independent time - sub second.  Later, sockets up
//    - Timeline status updated - sub second.  Independent queue.
//
//=================================================================================================

var LOCK_RENEWAL_MS = 60 * 1000;

export class JobContext extends ExecutionContext {
    constructor(job: ifm.JobRequestMessage,
        service: cm.IFeedbackChannel,
        workerCtx: WorkerContext) {

        ensureTrace(workerCtx);
        trace.enter('JobContext');

        this.job = job;

        var info: cm.IJobInfo = cm.jobInfoFromJob(job);

        this.jobInfo = info;
        trace.state('this.jobInfo', this.jobInfo);
        this.service = service;
        this.config = workerCtx.config;
        trace.state('this.config', this.config);

        super(info, job.jobId, service, workerCtx);
    }

    public job: ifm.JobRequestMessage;
    public jobInfo: cm.IJobInfo;
    public service: cm.IFeedbackChannel;

    //------------------------------------------------------------------------------------
    // Job/Task Status
    //------------------------------------------------------------------------------------
    public finishJob(result: ifm.TaskResult, callback: (err: any) => void): void {
        trace.enter('finishJob');
        trace.state('result', ifm.TaskResult[result]);

        this.setTaskResult(this.job.jobId, this.job.jobName, result);

        var jobRequest: ifm.TaskAgentJobRequest = <ifm.TaskAgentJobRequest>{};
        jobRequest.requestId = this.job.requestId;
        jobRequest.finishTime = new Date();
        jobRequest.result = result;

        trace.state('jobRequest', jobRequest);
        trace.state('this.config', this.config);

        // marking the job complete and then drain so the next worker can start
        this.service.updateJobRequest(this.config.poolId,
            this.job.lockToken,
            jobRequest,
            (err: any) => {
                trace.write('draining feedback');
                this.service.drain(callback);
            });
    }

    public writeConsoleSection(message: string) {
        this.service.queueConsoleSection(message);
    }

    public setJobInProgress(): void {
        trace.enter('setJobInProgress');
        var jobId = this.job.jobId;

        // job
        this.service.setCurrentOperation(jobId, "Starting");
        this.service.setName(jobId, this.job.jobName);
        this.service.setStartTime(jobId, new Date());
        this.service.setState(jobId, ifm.TimelineRecordState.InProgress);
        this.service.setType(jobId, "Job");
        this.service.setWorkerName(jobId, this.config.settings.agentName);
    }

    public registerPendingTask(id: string, name: string, order: number): void {
        trace.enter('registerPendingTask');
        this.service.setCurrentOperation(id, "Initializing");
        this.service.setParentId(id, this.job.jobId);
        this.service.setName(id, name);
        this.service.setState(id, ifm.TimelineRecordState.Pending);
        this.service.setType(id, "Task");
        this.service.setWorkerName(id, this.config.settings.agentName);
        this.service.setOrder(id, order);
    }

    public setTaskStarted(id: string, name: string): void {
        trace.enter('setTaskStarted');
        // set the job operation
        this.service.setCurrentOperation(this.job.jobId, 'Starting ' + name);

        // update the task
        this.service.setCurrentOperation(id, "Starting " + name);
        this.service.setStartTime(id, new Date());
        this.service.setState(id, ifm.TimelineRecordState.InProgress);
        this.service.setType(id, "Task");
        this.service.setName(id, name);
    }

    public setTaskResult(id: string, name: string, result: ifm.TaskResult): void {
        trace.enter('setTaskResult');
        this.service.setCurrentOperation(id, "Completed " + name);
        this.service.setState(id, ifm.TimelineRecordState.Completed);
        this.service.setFinishTime(id, new Date());
        this.service.setResult(id, result);
        this.service.setType(id, "Task");
        this.service.setName(id, name);
    }
}

//=================================================================================================
//
// PluginContext 
//
//  - used by plugin authors 
//  - has full access to the full job data including credentials etc...
//
//=================================================================================================

export class PluginContext extends ExecutionContext {
    constructor(job: ifm.JobRequestMessage,
        recordId: string,
        feedback: cm.IFeedbackChannel,
        workerCtx: WorkerContext) {

        this.job = job;
        var jobInfo: cm.IJobInfo = cm.jobInfoFromJob(job);

        super(jobInfo, recordId, feedback, workerCtx);
    }

    public job: ifm.JobRequestMessage;
}

//=================================================================================================
//
// TaskContext 
//
//  - pass to the task - available to custom task authors
//  - DOES NOT have access to the full job data including credentials etc...
//  - provided access to a set of task util libraries (ctx.util)
//
//=================================================================================================

export class TaskContext extends ExecutionContext {
    constructor(jobInfo: cm.IJobInfo,
        recordId: string,
        feedback: cm.IFeedbackChannel,
        workerCtx: WorkerContext) {

        super(jobInfo, recordId, feedback, workerCtx);
    }

    public inputs: ifm.TaskInputs;
}
