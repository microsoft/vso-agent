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

import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');

export class AgentApi {
	accountUrl: string;
	httpClient: httpm.HttpClient;
	restClient: restm.RestClient;

	constructor(accountUrl:string, handler: ifm.IRequestHandler) {
		this.accountUrl = accountUrl;
		this.httpClient = new httpm.HttpClient('vso-build-api', handler);
		this.restClient = new restm.RestClient(accountUrl, this.httpClient);		
	}

	//
	// TODO: do options request to avoid path math
	//
	connect(onResult: (err: any, statusCode: number, obj: any) => void): void {
		this.restClient.getJson('/_apis/connectionData', onResult);
	}

	getAgentPools(poolName: string, onResult: (err: any, statusCode: number, pools: ifm.TaskAgentPool[]) => void): void {
		var resPath: string = '/_apis/distributedtask/pools';
		if (poolName)
			resPath += '?poolName=' + poolName;

		this.restClient.getJsonWrappedArray(resPath, onResult);	
	}

	getAgents(poolId: number, agentName: string, onResult: (err: any, statusCode: number, agents: ifm.TaskAgent[]) => void): void {
		var resPath: string = '/_apis/distributedtask/pools/' + poolId + '/agents';
		if (agentName)
			resPath += '?agentName=' + agentName;

		this.restClient.getJsonWrappedArray(resPath, onResult);	
	}

	createAgent(poolId: number, agent: ifm.TaskAgent, onResult: (err: any, statusCode: number, agent: ifm.TaskAgent) => void): void {
		this.restClient.create('/_apis/distributedtask/pools/' + poolId + '/agents', agent, onResult);
	}

	updateAgent(poolId: number, agent: ifm.TaskAgent, onResult: (err: any, statusCode: number, agent: ifm.TaskAgent) => void): void {
		this.restClient.replace('/_apis/distributedtask/pools/' + poolId + '/agents/' + agent.id, agent, onResult);
	}

	createSession(poolId: number, session: ifm.TaskAgentSession, onResult: (err: any, statusCode: number, session: ifm.TaskAgentSession) => void): void {
		this.restClient.create('/_apis/distributedtask/pools/' + poolId + '/sessions', session, onResult);
	}

	deleteSession(poolId: number, sessionId: string, onResult: (err: any, statusCode: number, session: ifm.TaskAgentSession) => void): void {
		this.restClient.delete('/_apis/distributedtask/pools/' + poolId + '/sessions/' + sessionId, onResult);
	}

	getMessage(poolId: number, sessionId: string, onResult: (err: any, statusCode: number, message: any) => void): void {
		var path: string = '_apis/distributedtask/pools/' + poolId + '/messages?sessionId=' + sessionId;
		this.restClient.getJson(path, onResult);
	}

	deleteMessage(poolId: number, sessionId: string, messageId: number, onResult: (err: any, statusCode: number) => void): void {
		this.restClient.delete('/_apis/distributedtask/pools/' + poolId + '/messages?sessionId=' + sessionId + '&messageId=' + messageId, onResult);
	}

	updateJobRequest(poolId: number, lockToken: string, jobRequest: ifm.TaskAgentJobRequest, onResult: (err: any, statusCode: number, jobRequest: ifm.TaskAgentJobRequest) => void): void {
		var resPath: string = '/_apis/distributedtask/pools/' + poolId + '/jobrequests/' + jobRequest.requestId;
		if (lockToken)
			resPath += '?lockToken=' + lockToken;

		this.restClient.update(resPath, jobRequest, onResult);
	}
}
