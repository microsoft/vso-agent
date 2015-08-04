// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// ---------------------------------------------------------------------------
// API Client Interfaces
//----------------------------------------------------------------------------

/// <reference path="../definitions/node.d.ts" />
/// <reference path="../definitions/Q.d.ts" />

import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

//-----------------------------------------------------
// FileContainer Api
//-----------------------------------------------------
export enum ContainerItemType {
    Any = 0,
    Folder = 1,
    File = 2
}

export interface ContainerItemInfo {
    fullPath: string;
    containerItem?: FileContainerItem;
    contentIdentifier?: Buffer;
    compressedLength?: number;
    uncompressedLength?: number;
    isGzipped: boolean;
}

export interface FileContainerItem {
    containerId: number;
    itemType: ContainerItemType;
    path: string;
    contentId?: string;
    fileLength?: number;
}

export interface IFileContainerApi {
    uploadFile(containerId: number, 
              itemPath: string, 
              contentStream: NodeJS.ReadableStream, 
              contentIdentifier: Buffer, 
              uncompressedLength: number, 
              compressedLength: number, 
              isGzipped: boolean,
              onResult: (err: any, statusCode: number, item: FileContainerItem) => void): void;
}

export interface IQFileContainerApi {
    uploadFile(containerId: number, 
        itemPath: string, 
        contentStream: NodeJS.ReadableStream, 
        contentIdentifier: Buffer, 
        uncompressedLength: number, 
        compressedLength: number, 
        isGzipped: boolean): Q.Promise<FileContainerItem>
}

// ---------------------------------------------------------------------------
// Job Message Interfaces
//----------------------------------------------------------------------------

export interface TaskInputs {
    [key: string]: string;
}

export interface JobVariables {
    [key: string]: string;
}

//-----------------------------------------------------
// TestManagement Api
//-----------------------------------------------------
export interface Build 
{
    id: string;
}

export interface TestRun {
    name: string;
    id: number;
    iteration: string;
    state: string;
    automated: boolean;
    errorMessage: string;
    dueDate: Date;
    type: string;
    controller: string;
    buildDropLocation: string;
    buildPlatform: string;
    buildFlavor: string;
    comment: string;
    testEnvironmentId: string;
    startDate: Date;
    completeDate: Date;
    releaseUri: string;
    build: Build;
}

export interface TestRunResult {
    state: string;
    computerName: string;
    resolutionState: string;
    testCasePriority: number;
    failureType: string;
    automatedTestName: string;
    automatedTestStorage: string;
    automatedTestType: string;
    automatedTestTypeId: string;
    automatedTestId: string;
    area: string;
    owner: string;
    runBy: string;
    testCaseTitle: string;
    revision: number;
    dataRowCount: number;
    testCaseRevision: number;
    outcome: string;
    errorMessage: string;
    startedDate: Date;
    completedDate: Date;
    durationInMs: number;
}

export interface TestRun2 {
    testRun: TestRun;
    testResults: TestRunResult[];
}

export interface ITestManagementApi {
    accountUrl: string;
    httpClient: baseifm.IHttpClient;
    restClient: baseifm.IRestClient;
    createTestRun(testRun: TestRun, onResult: (err: any, statusCode: number, publishedTestRun: TestRun) => void): void;
    endTestRun(testRunId: number, onResult: (err: any, statusCode: number, publishedTestRun: TestRun) => void): void;
    createTestRunResult(testRunId: number, testRunResults: TestRunResult[], onResult: (err: any, statusCode: number, createdTestRunResults: TestRunResult[]) => void): void;
    createTestRunAttachment(testRunId: number, fileName: string, contents: string, onResult: (err: any, statusCode: number, obj: any) => void): void;
}

// Q Promise Interface
export interface IQTestManagementApi {
    createTestRun(testRun: TestRun): Q.Promise<TestRun>;
    endTestRun(testRunId: number): Q.Promise<TestRun>;
    createTestRunResult(testRunId: number, testRunResults: TestRunResult[]): Q.Promise<TestRunResult[]>;
    createTestRunAttachment(testRunId: number, fileName: string, contents: string): Q.Promise<any>;
}
