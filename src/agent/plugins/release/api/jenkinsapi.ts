/*
* ---------------------------------------------------------
* Copyright(C) Microsoft Corporation. All rights reserved.
* ---------------------------------------------------------
*/

// Licensed under the MIT license.  See LICENSE file in the project root for full license information.

import basem = require('vso-node-api/ClientApiBases');
import VsoBaseInterfaces = require('vso-node-api/interfaces/common/VsoBaseInterfaces');

export interface IJenkinsApi extends basem.ClientApiBase {
    getArtifactContentZip(jobName: string, job: string, relativePath: string, onResult: (err: any, statusCode: number, res: NodeJS.ReadableStream) => void): void;
}

export class JenkinsApi extends basem.ClientApiBase implements IJenkinsApi {

    constructor(baseUrl: string, handlers: VsoBaseInterfaces.IRequestHandler[]) {
        super(baseUrl, handlers, 'node-jenkins-api');
    }

    /**
     * Gets the artifact as a zip
     * 
     * @param {string} jobName - Job name of the artifact
     * @param {string} job - Job to be downloaded
     * @param {string} relativePath - Relative path inside the artifact
     * @param onResult callback function with the resulting void
     */
    public getArtifactContentZip(
        jobName: string,
        job: string,
        relativePath: string,
        onResult: (err: any, statusCode: number, res: NodeJS.ReadableStream) => void
        ): void {

        var requestUrl = this.baseUrl + '/job/' + jobName + '/' + job + '/artifact/' + relativePath + '/*zip*/';
        this.httpClient.getStream(requestUrl, null, "application/zip", onResult);
    }
}