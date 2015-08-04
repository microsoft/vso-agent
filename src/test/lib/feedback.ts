// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cm = require('../../agent/common');
import ctxm = require('../../agent/context');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import ifm = require('../../agent/api/interfaces');
import taskm = require('vso-node-api/TaskApi');
import Q = require('q');
import events = require('events');

export class TestCmdQueue implements cm.IAsyncCommandQueue {
	constructor() {
		this.descriptions = [];
		this.failed = false;
		this.errorMessage = '';
	}

	public descriptions: string[];
    public push(cmd: cm.IAsyncCommand) {
    	this.descriptions.push(cmd.description);
    }

    public finishAdding() {}
    public waitForEmpty(): Q.Promise<any> {
    	var defer = Q.defer();
    	defer.resolve(null);
    	return defer.promise;
    }

    public startProcessing() {}
    public _processQueue(values: cm.IAsyncCommand[], callback: (err: any) => void) {
    	callback(null);
    }

    public failed: boolean;
    public errorMessage: string;
}

export class TestFeedbackChannel extends events.EventEmitter implements cm.IFeedbackChannel {
	public agentUrl: string;
	public collectionUrl: string;
	public taskApi: taskm.ITaskApi;
	public jobInfo: cm.IJobInfo;	
	public enabled: boolean;

	private _webConsole: string[];
	private _records: any;
	private _logPages: any;

	constructor() {
		super();
		this._webConsole = [];
		this._records = {};
		this._logPages = {};
	}


	public drain(): Q.Promise<any> {
		return Q(null);
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

    public createAsyncCommandQueue(taskCtx: ctxm.TaskContext): cm.IAsyncCommandQueue {
        return new TestCmdQueue();
    }	

	public addError(recordId: string, category: string, message: string, data: any): void {
		var record = this._getFromBatch(recordId);
		if (record.errorCount < 10) {
			var error = <agentifm.Issue> {};
			error.category = category;
			error.type = agentifm.IssueType.Error;
			error.message = message;
			error.data = data;
			record.issues.push(error);
		}

		record.errorCount++;
	}

	public addWarning(recordId: string, category: string, message: string, data: any): void {
		var record = this._getFromBatch(recordId);
		if (record.warningCount < 10) {
			var warning = <agentifm.Issue> {};
			warning.category = category;
			warning.type = agentifm.IssueType.Error;
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

	public setState(recordId: string, state: agentifm.TimelineRecordState): void {
		this._getFromBatch(recordId).state = state;
	}

	public setResult(recordId: string, result: agentifm.TaskResult): void {
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

	public setLogId(recordId: string, logRef: agentifm.TaskLogReference): void {
		this._getFromBatch(recordId).log = logRef;
	}

	public setOrder(recordId: string, order: number): void {
		this._getFromBatch(recordId).order = order;
	}

	public finishJobRequest(poolId: number, lockToken: string, jobRequest: agentifm.TaskAgentJobRequest): Q.Promise<any> {
		return Q(null);
	}

    public uploadFileToContainer(containerId: number, containerItemTuple: ifm.ContainerItemInfo): Q.Promise<any> {
    	return Q(containerItemTuple);
    }  

    public postArtifact(projectId: string, buildId: number, artifact: buildifm.BuildArtifact): Q.Promise<buildifm.BuildArtifact> {
        return Q(artifact);
    }	

	public getRecordsString(): string {
		return JSON.stringify(this._records);
	}

	public jobsCompletedSuccessfully(): boolean {
		for(var id in this._records) {
			if (this._records.hasOwnProperty(id)) {
				var record = this._records[id];
				if (record.state != agentifm.TimelineRecordState.Completed) {
					return false;
				} else if(record.result != agentifm.TaskResult.Succeeded) {
					return false;
				}
			}
		}
		return true;
	}

	public confirmFailure(recordId: string): boolean {
		if (!this._records.hasOwnProperty(recordId)) {
			var record = this._records[recordId];

			if (record.result && record.result == agentifm.TaskResult.Failed) {
				return true;
			}
		}

		return false;
	}

    //------------------------------------------------------------------
    // Test publishing Items
    //------------------------------------------------------------------  
    public initializeTestManagement(projectName: string): void {
		var record = this._getFromBatch("1.createTestRun");
		record.result = agentifm.TaskResult.Failed;
		record.state = agentifm.TimelineRecordState.Completed;

		var record = this._getFromBatch("2.createTestRunAttachment");
		record.result = agentifm.TaskResult.Failed;
		record.state = agentifm.TimelineRecordState.Completed;

		var record = this._getFromBatch("3.createTestRunResult");
		record.result = agentifm.TaskResult.Failed;
		record.state = agentifm.TimelineRecordState.Completed;

		var record = this._getFromBatch("4.endTestRun");
		record.result = agentifm.TaskResult.Failed;
		record.state = agentifm.TimelineRecordState.Completed;
    }

    public createTestRun(testRun: ifm.TestRun): Q.Promise<ifm.TestRun> {
		var defer = Q.defer();

		this._getFromBatch("1.createTestRun").result = agentifm.TaskResult.Succeeded;

        var createdTestRun: ifm.TestRun = <ifm.TestRun> {
            name: testRun.name,
        	id: 99
        };

        // fail the create test run step, whenever id = -1, and validate from testcode that error is propagated back   
        if (testRun.id && testRun.id == -1)
        {
            var err = {
		        message: "Too bad - createTestRun failed",
	    	    statusCode: "400"
        	};
        	defer.reject(err);
        }
        else 
        {
        	defer.resolve(createdTestRun);
        }
            
        return <Q.Promise<ifm.TestRun>>defer.promise;  
    }

    public endTestRun(testRunId: number) : Q.Promise<ifm.TestRun> {
		var defer = Q.defer();

		this._getFromBatch("4.endTestRun").result = agentifm.TaskResult.Succeeded;

		var createdTestRun: ifm.TestRun = <ifm.TestRun> {
        	id: 99,
        	state: "Completed"
        };

        // fail the end test run step, whenever id = -1, and validate from testcode that error is propagated back   
        if (testRunId == -1)
        {
            var err = {
		        message: "Too bad - endTestRun failed",
	    	    statusCode: "400"
        	};
        	defer.reject(err);
        }
        else 
        {
        	defer.resolve(createdTestRun);
        }
            
        return <Q.Promise<ifm.TestRun>>defer.promise;  
	}

    public createTestRunResult(testRunId: number, testRunResults: ifm.TestRunResult[]): Q.Promise<ifm.TestRunResult[]> {
		var defer = Q.defer();

		this._getFromBatch("3.createTestRunResult").result = agentifm.TaskResult.Succeeded;

        var createdTestResults = [];
	    var testResult : ifm.TestRunResult = <ifm.TestRunResult> {
            state: "Completed",
            computerName: "localhost",
            resolutionState: null,
            testCasePriority: 1,
            failureType: null,
            automatedTestName: "testName",
            automatedTestStorage: "testStorage",
            automatedTestType: "JUnit",
            automatedTestTypeId: null,
            automatedTestId: null,
            area: null,
            owner: "buildRequestedFor", 
            runBy: "buildRequestedFor",
            testCaseTitle: "testName",
            revision: 0,
            dataRowCount: 0,
            testCaseRevision: 0,
            outcome: 'Failed',
            errorMessage: "errorMessage",
            durationInMs: 1000
	    };
    	
    	createdTestResults.push(testResult);

        // fail the add results step, whenever id = -1, and validate from testcode that error is propagated back   
        if (testRunId == -1)
        {
            var err = {
		        message: "Too bad",
	    	    statusCode: "400"
        	};
        	defer.reject(err);
        }
        else 
        {
        	defer.resolve(createdTestResults);
        }

        return <Q.Promise<ifm.TestRunResult[]>>defer.promise;  
    }

    public createTestRunAttachment(testRunId: number, fileName: string, contents: string): Q.Promise<any> {
		var defer = Q.defer();

		this._getFromBatch("2.createTestRunAttachment").result = agentifm.TaskResult.Succeeded;

        // always fail attachment upload; and validate from testcode that, the task still succeeds 
        // - failure to upload an atatchment (say because of size > 100MB, etc), should not stop publishing of test results 
		var err = {
	        message: "Too bad",
    	    statusCode: "400"
        };
        defer.reject(err);

        return <Q.Promise<any>>defer.promise;  
    }

	private _getFromBatch(recordId: string) {
		if (!this._records.hasOwnProperty(recordId)) {
			this._records[recordId] = {};
		}

		return this._records[recordId];
	}
}