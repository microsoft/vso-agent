// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');

export class TaskApi implements ifm.ITaskApi{
    accountUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(accountUrl: string, handler: ifm.IRequestHandler) {
        this.accountUrl = accountUrl;
        this.httpClient = new httpm.HttpClient('vso-task-api', handler);
        this.restClient = new restm.RestClient(accountUrl, '1.0', this.httpClient);
    }

    getTasks(taskId: string, onResult: (err: any, statusCode: number, tasks: ifm.TaskDefinition[]) => void): void {
        var relUrl = '/_apis/distributedtask/tasks';

        if (taskId) {
            relUrl = relUrl + '/' + taskId;
        }

        this.restClient.getJsonWrappedArray(relUrl, onResult);
    }

    downloadTask(taskId: string, version: string, filePath: string, onResult: (err: any, statusCode: number) => void): void {
        var relUrl = '/_apis/distributedtask/tasks/' + taskId + '/' + version;

        this.restClient.downloadFile(relUrl, filePath, 'application/zip', onResult);
    }
}
