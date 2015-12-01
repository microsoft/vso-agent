// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import rmInterfaces = require('../api/interfaces');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import common = require('../../../common');
import utilm = require('../../../utilities');
import path = require('path');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import fs = require('fs');
import cm = require('../../../common');
import Q = require('q');
import releaseCommon = require('../lib/common');
import jenkinsapim = require('../api/jenkinsapi');
var shell = require('shelljs');
var zip = require('adm-zip');

export class JenkinsArtifact implements rmInterfaces.IArtifact {
    public download(context: common.IExecutionContext, artifactDefinition: releaseIfm.AgentArtifactDefinition, artifactFolder: string): Q.Promise<void> {
        var defer = Q.defer<void>();
        try {
            var jenkinsDetails = JSON.parse(artifactDefinition.details, releaseCommon.reviver);
            var jenkinsEndpoint: agentifm.ServiceEndpoint;
            context.jobInfo.jobMessage.environment.endpoints.some((endpoint: agentifm.ServiceEndpoint) => {
                if (endpoint.name === jenkinsDetails.connectionName) {
                    jenkinsEndpoint = endpoint;
                    return true;
                }
            });

            if (jenkinsEndpoint === null) {
                defer.reject('Cannot find required information in the job to download the Jenkins artifact: ' + jenkinsDetails.connectionName);
                return;
            }

            context.info('Created artifact folder: ' + artifactFolder);

            var zipSource = path.join(artifactFolder, 'download.zip');
            var fileStream: NodeJS.WritableStream = fs.createWriteStream(zipSource);
            var creds: baseifm.IBasicCredentials = <baseifm.IBasicCredentials>{};
            creds.username = this.getAuthParameter(jenkinsEndpoint, 'Username');
            creds.password = this.getAuthParameter(jenkinsEndpoint, 'Password');
            var jenkinsApi = new jenkinsapim.JenkinsApi(jenkinsEndpoint.url, [cm.basicHandlerFromCreds(creds)]);
            jenkinsApi.getArtifactContentZip(jenkinsDetails.jobName, artifactDefinition.version.toString(), jenkinsDetails.relativePath, (err, statusCode, res) => {
                if (err) {
                    context.info('Error downloading artifact: ' + artifactDefinition.name);
                    defer.reject(err);
                    return;
                }
                else if (statusCode > 299) {
                    defer.reject("Failed Request: " + statusCode);
                    return;
                }
                res.pipe(fileStream);
                fileStream.on('finish', function () {
                    cm.extractFile(zipSource, artifactFolder, (err) => {
                        if (err) {
                            context.info('Error extracting artifact: ' + artifactDefinition.name);
                            defer.reject(err);
                            return;
                        }

                        shell.mv('-f', path.join(path.join(artifactFolder, 'archive'), '*'), artifactFolder);
                        var errorMessage = shell.error();
                        if (errorMessage) {
                            fileStream.end();
                            defer.reject(errorMessage);
                            return;
                        }
                        shell.rm('-rf', zipSource, path.join(artifactFolder, 'archive'));
                        errorMessage = shell.error();
                        if (errorMessage) {
                            fileStream.end();
                            defer.reject(errorMessage);
                            return;
                        }
                        fileStream.end();
                        defer.resolve(null);
                        return;
                    });
                });
            });
        }
        catch (error) {
            context.info('There was problem in downloading the artifact: ' + artifactDefinition.name);
            defer.reject(error);
            return;
        }

        return defer.promise;
    }

    public getAuthParameter(endpoint: agentifm.ServiceEndpoint, paramName: string) {
        var paramValue = null;
        if (endpoint && endpoint.authorization && endpoint.authorization['parameters']) {
            var parameters = Object.getOwnPropertyNames(endpoint.authorization['parameters']);
            var keyName: string;
            parameters.some(key => {
                if (key.toLowerCase() === paramName.toLowerCase()) {
                    keyName = key;
                    return true;
                }
            });
            paramValue = endpoint.authorization['parameters'][keyName];
        }

        return paramValue;
    }

}