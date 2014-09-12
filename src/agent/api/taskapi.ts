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

export class TaskApi {
    collectionUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(collectionUrl: string, handler: ifm.IRequestHandler) {
        this.collectionUrl = collectionUrl;
        this.httpClient = new httpm.HttpClient('vso-task-api', handler);
        this.restClient = new restm.RestClient(collectionUrl, this.httpClient);
    }

    createLog(planId: string, logPath: string, onResult: (err: any, statusCode: number, log: ifm.TaskLog) => void): void {
        var log: ifm.TaskLog = <ifm.TaskLog>{};
        log.path = logPath;
        this.restClient.create('/_apis/distributedtask/plans/' + planId + '/logs', log, onResult);
    }

    uploadLogFile(planId: string, logId: number, filePath: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this.restClient.uploadFile('_apis/distributedtask/plans/' + planId + '/logs/' + logId, filePath, onResult);
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

        this.restClient.updateJsonWrappedArray('/_apis/distributedtask/plans/' + planId + '/timelines/' + timelineId + '/records', genericRecords, onResult);
    }

    appendTimelineRecordFeed(planId: string, timelineId: string, recordId: string, lines: string[], onResult: (err: any, statusCode: number, obj: any) => void): void {
        var relUrl = '/_apis/distributedtask/plans/' + planId + '/timelines/' + timelineId +
            '/records/' + recordId + '/feed';

        this.restClient.createJsonWrappedArray(relUrl, lines, onResult);
    }

}
