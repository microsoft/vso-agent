// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cm = require('../../agent/common');
import ifm = require('../../agent/api/interfaces');

export class TestFeedbackChannel implements cm.IFeedbackChannel {
	public agentUrl: string;
	public taskUrl: string;
	public timelineApi: ifm.ITimelineApi;
	public jobInfo: cm.IJobInfo;	
	public enabled: boolean;

	private _webConsole: string[];
	private _records: any;
	private _logPages: any;

	constructor() {
		this._webConsole = [];
		this._records = {};
		this._logPages = {};
	}


	public drain(callback: (err: any) => void): void {
		callback(null);
	}

	public queueLogPage(page: cm.ILogPageInfo): void {
		if (!this._logPages.hasOwnProperty(page.logInfo.recordId)) {
			this._logPages[page.logInfo.recordId] = [];
		}

		this._logPages[page.logInfo.recordId].push(page);
	}

	public queueConsoleLine(line: string): void {
		this._webConsole.push(line);
	}

	public queueConsoleSection(line: string): void {
		this._webConsole.push('[section] ' + line);
	}

	public addError(recordId: string, category: string, message: string, data: any): void {
		var record = this._getFromBatch(recordId);
		if (record.errorCount < 10) {
			var error = <ifm.TaskIssue> {};
			error.category = category;
			error.issueType = ifm.TaskIssueType.Error;
			error.message = message;
			error.data = data;
			record.issues.push(error);
		}

		record.errorCount++;
	}

	public addWarning(recordId: string, category: string, message: string, data: any): void {
		var record = this._getFromBatch(recordId);
		if (record.warningCount < 10) {
			var warning = <ifm.TaskIssue> {};
			warning.category = category;
			warning.issueType = ifm.TaskIssueType.Error;
			warning.message = message;
			warning.data = data;
			record.issues.push(warning);
		}

		record.warningCount++;
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

	public updateJobRequest(poolId: number, lockToken: string, jobRequest: ifm.TaskAgentJobRequest, callback: (err: any) => void): void {
		callback(null);
	}

	public printConsole(): void {
		console.log(this._webConsole);
	}

	public printRecords(): void {
		console.log(JSON.stringify(this._records));
	}

	public printLogPages(): void {
		console.log(JSON.stringify(this._logPages));
	}

	public getRecordsString(): string {
		return JSON.stringify(this._records);
	}

	public jobsCompletedSuccessfully(): boolean {
		for(var id in this._records) {
			if (this._records.hasOwnProperty(id)) {
				var record = this._records[id];
				if (record.state != ifm.TimelineRecordState.Completed) {
					return false;
				} else if(record.result != ifm.TaskResult.Succeeded) {
					return false;
				}
			}
		}
		return true;
	}

	public confirmFailure(recordId: string): boolean {
		if (!this._records.hasOwnProperty(recordId)) {
			var record = this._records[recordId];

			if (record.result && record.result == ifm.TaskResult.Failed) {
				return true;
			}
		}

		return false;
	}

	private _getFromBatch(recordId: string) {
		if (!this._records.hasOwnProperty(recordId)) {
			this._records[recordId] = {};
		}

		return this._records[recordId];
	}
}