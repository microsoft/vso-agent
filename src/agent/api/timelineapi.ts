// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/vso-node-api.d.ts" />

import ifm = require('./interfaces');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces')
import httpm = require('vso-node-api/HttpClient');
import restm = require('vso-node-api/RestClient');

export class TimelineApi implements ifm.ITimelineApi {
    collectionUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(collectionUrl: string, handlers: baseifm.IRequestHandler[]) {
        this.collectionUrl = collectionUrl;
        this.httpClient = new httpm.HttpClient('vso-task-api', handlers);
        this.restClient = new restm.RestClient(this.httpClient);
    }

    createLog(planId: string, logPath: string, onResult: (err: any, statusCode: number, log: agentifm.TaskLog) => void): void {
        var log: agentifm.TaskLog = <agentifm.TaskLog>{};
        log.path = logPath;
        this.restClient.create('/_apis/distributedtask/plans/' + planId + '/logs', "3.0-preview.1", log, null, onResult);
    }

    uploadLogFile(planId: string, logId: number, filePath: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this.restClient.uploadFile('_apis/distributedtask/plans/' + planId + '/logs/' + logId, "3.0-preview.1", filePath, null, null, onResult);
    }

    updateTimelineRecords(planId: string, timelineId: string, records: agentifm.TimelineRecord[], onResult: (err: any, statusCode: number, records: agentifm.TimelineRecord[]) => void): void {
        // ensure enum goes as a string
        var genericRecords = [];

        records.forEach(function (record) {
            var genericRecord = <any>record;

            if (record.hasOwnProperty('state')) {
                genericRecord.state = restm.enumToString(agentifm.TimelineRecordState, record.state, true);
            }

            if (record.hasOwnProperty('result')) {
                genericRecord.result = restm.enumToString(agentifm.TaskResult, record.result, true);
            }

            genericRecords.push(genericRecord);
        });

        this.restClient.updateJsonWrappedArray('/_apis/distributedtask/plans/' + planId + '/timelines/' + timelineId + '/records', "3.0-preview.1", genericRecords, null, onResult);
    }

    appendTimelineRecordFeed(planId: string, timelineId: string, recordId: string, lines: string[], onResult: (err: any, statusCode: number, obj: any) => void): void {
        var relUrl = '/_apis/distributedtask/plans/' + planId + '/timelines/' + timelineId +
            '/records/' + recordId + '/feed';

        this.restClient.createJsonWrappedArray(relUrl, "3.0-preview.1", lines, null, onResult);
    }
}
