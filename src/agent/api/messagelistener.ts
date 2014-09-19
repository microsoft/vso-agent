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
var uuid = require('node-uuid');
var QUEUE_RETRY_DELAY = 15000;

export class MessageListener {
	sessionId: string;
	poolId: number;
	agentapi: ifm.IAgentApi;
	agent: ifm.TaskAgent;

	constructor(agentapi: ifm.IAgentApi, agent: ifm.TaskAgent, poolId: number) {
		this.agentapi = agentapi;
		this.agent = agent;
		this.poolId = poolId;
	}

	getMessages(callback: (err: any, message: ifm.TaskAgentMessage) => void): void {

		this.agentapi.getMessage(this.poolId, this.sessionId, (err:any, statusCode: number, obj: any) => {
			
			// resetting the long poll - reconnect immediately
			if (statusCode == 202 || (err && err.code === 'ECONNRESET')) {
				this.getMessages(callback);
				return;
			}

			// the queue should be robust to the server being unreachable - wait and reconnect
			if (err) {
	        	console.error('Could not connect to the queue.  Retrying in ' + QUEUE_RETRY_DELAY/1000 + ' sec');
	            setTimeout(() => {
	            		this.getMessages(callback);
	            	}, QUEUE_RETRY_DELAY);
				return;
			}

			callback(null, obj);

			// the message has been handed off to the caller - delete the message and listen for the next one
			var messageId = obj.messageId;
			this.agentapi.deleteMessage(this.poolId, this.sessionId, messageId, (err:any, statusCode: number) => {
				// TODO: how to handle failure in deleting message?  Just log?  we need to continue nd get the next message ...
				this.getMessages(callback);
			});
		});
	}

	start(callback: (err: any, message: any) => void): void {
		var session: ifm.TaskAgentSession = <ifm.TaskAgentSession>{};
		session.agent = this.agent;
		session.ownerName = uuid.v1();
		// session.sessionId = '00000000-0000-0000-0000-000000000000';

		// createSession(poolId: number, agent: ifm.TaskAgent, onResult: (err: any, statusCode: number, session: ifm.TaskAgentSession) 
		this.agentapi.createSession(this.poolId, session, (err, statusCode, session) => {
			if (err) {
				callback(err, null);
				return;
			}

			this.sessionId = session.sessionId;
			this.getMessages(callback)	
		});	
	}

	stop(callback: (err: any) => void): void {
		if (this.sessionId)
		{
			this.agentapi.deleteSession(this.poolId, this.sessionId, (err, statusCode) => {
				callback(err);
			});
		}
	}
}
