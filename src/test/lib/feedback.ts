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

import cm = require('../../agent/common');
import ifm = require('../../agent/api/interfaces');

export class TestFeedbackChannel implements cm.IFeedbackChannel {
	agentUrl: string;
	taskUrl: string;
	taskApi: ifm.ITaskApi;
	jobInfo: cm.IJobInfo;	
	enabled: boolean;

	drain(callback: (err: any) => void): void {
		callback(null);
	}

	queueLogPage(page: cm.ILogPageInfo): void {

	}

	queueConsoleLine(line: string): void {

	}

	queueConsoleSection(line: string): void {

	}

	setCurrentOperation(recordId: string, operation: string): void {

	}

	setName(recordId: string, name: string): void {

	}

	setStartTime(recordId: string, startTime: Date): void {

	}

	setFinishTime(recordId: string, finishTime: Date): void {

	}

	setState(recordId: string, state: ifm.TimelineRecordState): void {

	}

	setResult(recordId: string, result: ifm.TaskResult): void {

	}

	setType(recordId: string, type: string): void {

	}

	setParentId(recordId: string, parentId: string): void {

	}

	setWorkerName(recordId: string, workerName: string): void {

	}

	setLogId(recordId: string, logRef: ifm.TaskLogReference): void {

	}

	updateJobRequest(poolId: number, lockToken: string, jobRequest: ifm.TaskAgentJobRequest, callback: (err: any) => void): void {
		callback(null);
	}
}