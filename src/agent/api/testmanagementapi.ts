// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/node.d.ts"/>
/// <reference path="../definitions/Q.d.ts" />
/// <reference path="../definitions/vso-node-api.d.ts" />

import Q = require('q');
import ifm = require('./interfaces');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import httpm = require('vso-node-api/HttpClient');
import restm = require('vso-node-api/RestClient');

export class TestManagementApi implements ifm.ITestManagementApi {
    accountUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(accountUrl:string, handlers: baseifm.IRequestHandler[]) {
        this.accountUrl = accountUrl;
        this.httpClient = new httpm.HttpClient('vso-build-api', handlers, 60000);
        this.restClient = new restm.RestClient(this.httpClient);
    }
    
    public createTestRun(testRun: ifm.TestRun, onResult: (err: any, statusCode: number, publishedTestRun: ifm.TestRun) => void): void {
        this.restClient.create('/_apis/test/runs', "3.0-preview.1", testRun, null, onResult);
    }

    public endTestRun(testRunId: number, onResult: (err: any, statusCode: number, publishedTestRun: ifm.TestRun) => void): void {
        var testRun: ifm.TestRun = <ifm.TestRun> {
            state: "Completed",
        };
        this.restClient.update('/_apis/test/runs/' + testRunId, "3.0-preview.1", testRun, null, onResult);
    }

    public createTestRunResult(testRunId: number, testRunResults: ifm.TestRunResult[], onResult: (err: any, statusCode: number, createdTestRunResults: ifm.TestRunResult[]) => void): void {
        this.restClient.create('/_apis/test/runs/' + testRunId + '/results', "3.0-preview.1", testRunResults, null, onResult);
    }

    public createTestRunAttachment(testRunId: number, fileName: string, contents: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        var attachmentData = {
            AttachmentType: "GeneralAttachment",
            Comment: "",
            FileName: fileName,
            Stream: contents
        };
        this.restClient.create('/_apis/test/runs/' + testRunId + '/Attachments', "3.0-preview.1", attachmentData, null, onResult);
    }

}

export class QTestManagementApi {
    testApi: ifm.ITestManagementApi;

    constructor(accountUrl:string, handlers: baseifm.IRequestHandler[]) {
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

    public createTestRunAttachment(testRunId: number, fileName: string, contents: string) {
        var defer = Q.defer();

        this.testApi.createTestRunAttachment(testRunId, fileName, contents, (err: any, statusCode: number, obj: any) => {
            if (err) {
                err.statusCode = statusCode;
                defer.reject(err);
            }
            else {
                defer.resolve(obj);
            }
        });

        return <Q.Promise<any>>defer.promise;
    }

}
