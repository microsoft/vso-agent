// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/node.d.ts"/>
/// <reference path="../definitions/vso-node-api.d.ts" />

import ifm = require('./interfaces');
import agentm = require('vso-node-api/TaskAgentApi');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import events = require('events');
var uuid = require('node-uuid');
var QUEUE_RETRY_DELAY = 15000;
var MAX_SESSION_RETRIES = 10;

var lastMessageId = 0;

export class MessageListener extends events.EventEmitter {
    sessionId: string;
    poolId: number;
    agentapi: agentm.ITaskAgentApi;
    agent: agentifm.TaskAgent;
    
    private _sessionRetryCount;

    constructor(agentapi: agentm.ITaskAgentApi, agent: agentifm.TaskAgent, poolId: number) {
        this.agentapi = agentapi;
        this.agent = agent;
        this.poolId = poolId;
        this._sessionRetryCount = 0;

        super();
    }

    getMessages(callback: (message: agentifm.TaskAgentMessage) => void, onError: (err: any) => void): void {

        this.emit('listening');

        this.agentapi.getMessage(this.poolId, this.sessionId, lastMessageId, (err: any, statusCode: number, obj: any) => {
            // exit on some conditions such as bad credentials
            if (statusCode == 401) {
                onError(new Error('Unauthorized.  Confirm credentials are correct and restart.  Exiting.'));
                return;
            }

            if (statusCode == 400) {
                onError(new Error('Invalid Configuration.  Check pools and agent configuration and restart'));
                return;
            }

            // resetting the long poll - reconnect immediately
            if (statusCode == 202 || (err && err.code === 'ECONNRESET')) {
                this.getMessages(callback, onError);
                return;
            }

            this.emit('info', 'working status code: ' + statusCode);

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
            lastMessageId = obj.messageId;
            this.emit('info', 'processing messageId ' + lastMessageId);
            this.agentapi.deleteMessage(this.poolId, lastMessageId, this.sessionId, (err:any, statusCode: number) => {
                // TODO: how to handle failure in deleting message?  Just log?  we need to continue nd get the next message ...
                if (err) {
                    onError(err);
                }
                this.getMessages(callback, onError);
            });
        });
    }

    start(callback: (message: any) => void, onError: (err: any) => void): void {
        this.sessionId = null;
        var session: agentifm.TaskAgentSession = <agentifm.TaskAgentSession>{};
        session.agent = this.agent;
        session.ownerName = uuid.v1();

        this.agentapi.createSession(session, this.poolId, (err, statusCode, session) => {
            // exit on some conditions such as bad credentials
            if (statusCode == 401) {
                console.error('Unauthorized.  Confirm credentials are correct and restart.  Exiting.');
                return;
            }
            
            if (err) {
                onError(new Error('Could not create an agent session.  Retrying in ' + QUEUE_RETRY_DELAY/1000 + ' sec'));
                onError(err);
                
                // retry 409 (session already exists) a few times
                if (statusCode == 409) {
                    if (this._sessionRetryCount++ < MAX_SESSION_RETRIES) {
                        setTimeout(() => {
                                this.start(callback, onError);
                            }, QUEUE_RETRY_DELAY);
                    }
                    else {
                        console.error('A session already exists for this agent. Is there a copy of this agent running elsewhere?');
                        this.emit('sessionUnavailable');
                    }
                }
                else {
                    // otherwise, just retry
                    setTimeout(() => {
                            this.start(callback, onError);
                        }, QUEUE_RETRY_DELAY);
                }
                return;
            }
            else {
                // success. reset retry count 
                this._sessionRetryCount = 0;
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