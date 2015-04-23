// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/node.d.ts"/>
/// <reference path="../definitions/Q.d.ts" />

import Q = require('q');
import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');

export class AgentApi implements ifm.IAgentApi {
    accountUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(accountUrl:string, handlers: ifm.IRequestHandler[]) {
        this.accountUrl = accountUrl;
        this.httpClient = new httpm.HttpClient('vso-build-api', handlers, 60000);
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

        var genericRecord = <any>jobRequest;

        if (jobRequest.hasOwnProperty('result')) {
            genericRecord.result = restm.enumToString(ifm.TaskResult, jobRequest.result, true);
        }

        this.restClient.update(resPath, genericRecord, onResult);       
    }
}

// Q wrapper

export class QAgentApi {
    agentApi: ifm.IAgentApi;

    constructor(accountUrl:string, handlers: ifm.IRequestHandler[]) {
        this.agentApi = new AgentApi(accountUrl, handlers);
    }

    public connect(): Q.Promise<any> {
        var defer = Q.defer();

        this.agentApi.connect((err: any, statusCode: number, obj: any) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(obj);
            }
        });

        return defer.promise;       
    }

    public getAgentPools(poolName: string): Q.Promise<ifm.TaskAgentPool[]> {
        var defer = Q.defer();

        this.agentApi.getAgentPools(poolName, (err: any, statusCode: number, pools: ifm.TaskAgentPool[]) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(pools);
            }
        });

        return <Q.Promise<ifm.TaskAgentPool[]>>defer.promise;       
    }

    public getAgents(poolId: number, agentName: string): Q.Promise<ifm.TaskAgent[]> {
        var defer = Q.defer();

        this.agentApi.getAgents(poolId, agentName, (err: any, statusCode: number, agents: ifm.TaskAgent[]) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(agents);
            }
        });

        return <Q.Promise<ifm.TaskAgent[]>>defer.promise;
    }

    public createAgent(poolId: number, agent: ifm.TaskAgent): Q.Promise<ifm.TaskAgent> {
        var defer = Q.defer();

        this.agentApi.createAgent(poolId, agent, (err: any, statusCode: number, agent: ifm.TaskAgent) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(agent);
            }
        });

        return <Q.Promise<ifm.TaskAgent>>defer.promise;
    }

    public updateAgent(poolId: number, agent: ifm.TaskAgent): Q.Promise<ifm.TaskAgent> {
        var defer = Q.defer();

        this.agentApi.updateAgent(poolId, agent, (err: any, statusCode: number, agent: ifm.TaskAgent) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(agent);
            }
        });

        return <Q.Promise<ifm.TaskAgent>>defer.promise;
    }   
}
