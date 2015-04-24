// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/node.d.ts"/>
/// <reference path="../definitions/Q.d.ts" />

import Q = require('q');
import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');

export class TestManagementApi implements ifm.ITestManagementApi {
    accountUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(accountUrl:string, handlers: ifm.IRequestHandler[]) {
        this.accountUrl = accountUrl;
        this.httpClient = new httpm.HttpClient('vso-build-api', handlers, 60000);
        this.restClient = new restm.RestClient(accountUrl, this.httpClient);
    }
    
    public createTestRun(testRun: ifm.TestRun, onResult: (err: any, statusCode: number, publishedTestRun: ifm.TestRun) => void): void {
        this.restClient.create('/_apis/test/runs', testRun, onResult);
    }

    public endTestRun(testRunId: number, onResult: (err: any, statusCode: number, publishedTestRun: ifm.TestRun) => void): void {
        var testRun: ifm.TestRun = <ifm.TestRun> {
            state: "Completed",
        };
        this.restClient.update('/_apis/test/runs/' + testRunId, testRun, onResult);
    }

    public createTestRunResult(testRunId: number, testRunResults: ifm.TestRunResult[], onResult: (err: any, statusCode: number, createdTestRunResults: ifm.TestRunResult[]) => void): void {
    	this.restClient.create('/_apis/test/runs/' + testRunId + '/results', testRunResults, onResult);
	}
}

export class QTestManagementApi {
    testApi: ifm.ITestManagementApi;

    constructor(accountUrl:string, handlers: ifm.IRequestHandler[]) {
        this.testApi = new TestManagementApi(accountUrl, handlers);
    }

    public createTestRun(testRun: ifm.TestRun): Q.Promise<ifm.TestRun> {
        var defer = Q.defer();

        this.testApi.createTestRun(testRun, (err: any, statusCode: number, publishedTestRun: ifm.TestRun) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(publishedTestRun);
            }
        });

        return <Q.Promise<ifm.TestRun>>defer.promise;       
    }

    public endTestRun(testRunId: number) : Q.Promise<ifm.TestRun> {
        var defer = Q.defer();

        this.testApi.endTestRun(testRunId, (err: any, statusCode: number, publishedTestRun: ifm.TestRun) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(publishedTestRun);
            }
        });

        return <Q.Promise<ifm.TestRun>>defer.promise;       
    }

    public createTestRunResult(testRunId: number, testRunResults: ifm.TestRunResult[]): Q.Promise<ifm.TestRunResult[]> {
        var defer = Q.defer();

        this.testApi.createTestRunResult(testRunId, testRunResults, (err: any, statusCode: number, createdTestRunResults: ifm.TestRunResult[]) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(createdTestRunResults);
            }
        });

        return <Q.Promise<ifm.TestRunResult[]>>defer.promise;       
    }

}
