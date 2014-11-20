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
