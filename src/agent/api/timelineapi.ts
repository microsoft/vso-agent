// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');

export class TimelineApi implements ifm.ITimelineApi {
    collectionUrl: string;
    scopeIdentifier: string;
    hubName: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(scopeIdentifier: string, hubName: string, collectionUrl: string, handlers: ifm.IRequestHandler[]) {
        this.scopeIdentifier = scopeIdentifier;
        this.hubName = hubName;
        this.collectionUrl = collectionUrl;
        this.httpClient = new httpm.HttpClient('vso-task-api', handlers);
        this.restClient = new restm.RestClient(collectionUrl, this.httpClient);
    }

    createLog(planId: string, logPath: string, onResult: (err: any, statusCode: number, log: ifm.TaskLog) => void): void {
        var log: ifm.TaskLog = <ifm.TaskLog>{};
        log.path = logPath;
        this.restClient.create('/' + this.scopeIdentifier + '/_apis/distributedtask/hubs/' + this.hubName + '/plans/' + planId + '/logs', log, onResult);
    }

    uploadLogFile(planId: string, logId: number, filePath: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this.restClient.uploadFile('/' + this.scopeIdentifier + '/_apis/distributedtask/hubs/' + this.hubName + '/plans/' + planId + '/logs/' + logId, filePath, null, onResult);
    }

    updateTimelineRecords(planId: string, timelineId: string, records: ifm.TimelineRecord[], onResult: (err: any, statusCode: number, records: ifm.TimelineRecord[]) => void): void {
        // ensure enum goes as a string
        var genericRecords = [];

        records.forEach(function (record) {
            var genericRecord = <any>record;

            if (record.hasOwnProperty('state')) {
                genericRecord.state = restm.enumToString(ifm.TimelineRecordState, record.state, true);
            }

            if (record.hasOwnProperty('result')) {
                genericRecord.result = restm.enumToString(ifm.TaskResult, record.result, true);
            }

            genericRecords.push(genericRecord);
        });

        this.restClient.updateJsonWrappedArray('/' + this.scopeIdentifier + '/_apis/distributedtask/hubs/' + this.hubName + '/plans/' + planId + '/timelines/' + timelineId + '/records', genericRecords, onResult);
    }

    appendTimelineRecordFeed(planId: string, timelineId: string, recordId: string, lines: string[], onResult: (err: any, statusCode: number, obj: any) => void): void {
        var relUrl = '/' + this.scopeIdentifier + '/_apis/distributedtask/hubs/' + this.hubName + '/plans/' + planId + '/timelines/' + timelineId + '/records/' + recordId + '/feed';
        this.restClient.createJsonWrappedArray(relUrl, lines, onResult);
    }
}
