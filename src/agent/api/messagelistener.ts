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

	getMessages(callback: (message: ifm.TaskAgentMessage) => void, onError: (err: any) => void): void {

		this.agentapi.getMessage(this.poolId, this.sessionId, (err:any, statusCode: number, obj: any) => {
			
			// resetting the long poll - reconnect immediately
			if (statusCode == 202 || (err && err.code === 'ECONNRESET')) {
				this.getMessages(callback, onError);
				return;
			}

			// the queue should be robust to the server being unreachable - wait and reconnect
			if (err) {
	        	onError(new Error('Could not connect to the queue.  Retrying in ' + QUEUE_RETRY_DELAY/1000 + ' sec'));
	        	onError(err);
	            setTimeout(() => {
	            		this.getMessages(callback, onError);
	            	}, QUEUE_RETRY_DELAY);
				return;
			}

			callback(obj);

			// the message has been handed off to the caller - delete the message and listen for the next one
			var messageId = obj.messageId;
			this.agentapi.deleteMessage(this.poolId, this.sessionId, messageId, (err:any, statusCode: number) => {
				// TODO: how to handle failure in deleting message?  Just log?  we need to continue nd get the next message ...
				if (err) {
					onError(err);
				}
                this.getMessages(callback, onError);
			});
		});
	}

	start(callback: (message: any) => void, onError: (err: any) => void): void {
		var session: ifm.TaskAgentSession = <ifm.TaskAgentSession>{};
		session.agent = this.agent;
		session.ownerName = uuid.v1();

		this.agentapi.createSession(this.poolId, session, (err, statusCode, session) => {
			if (err) {
				onError(new Error('Could not create an agent session.  Retrying in ' + QUEUE_RETRY_DELAY/1000 + ' sec'));
				onError(err);
	            setTimeout(() => {
	            		this.start(callback, onError);
	            	}, QUEUE_RETRY_DELAY);
				return;
			}

			this.sessionId = session.sessionId;
			this.getMessages(callback, onError);
		});	
	}

	stop(callback: (err: any) => void): void {
		if (this.sessionId) {
			this.agentapi.deleteSession(this.poolId, this.sessionId, (err, statusCode) => {
				callback(err);
			});
		} else {
			callback(null);
		}
	}
}