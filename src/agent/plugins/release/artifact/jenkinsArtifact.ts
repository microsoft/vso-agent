// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import rmInterfaces = require('../api/interfaces');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import context = require('../../../context');
import ifm = require('../../../api/interfaces');
import utilm = require('../../../utilities');
import path = require('path');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import fs = require('fs');
import cm = require('../../../common');
import releaseCommon = require('../lib/common');
import webapim = require('vso-node-api/WebApi');
var shell = require('shelljs');
var zip = require('adm-zip');

export class JenkinsArtifact implements rmInterfaces.IArtifact {
    public download(context: context.JobContext, artifactDefinition: releaseIfm.AgentArtifactDefinition, artifactsFolder: string, asyncCallback): void {
        try {
            var jenkinsDetails: releaseIfm.AgentJenkinsArtifactDetails = JSON.parse(artifactDefinition.details, releaseCommon.reviver);
            var jenkinsEndpoint: agentifm.ServiceEndpoint;
            context.job.environment.endpoints.some((endpoint: agentifm.ServiceEndpoint) => {
                if (endpoint.name === jenkinsDetails.connectionName) {
                    jenkinsEndpoint = endpoint;
                    return true;
                }
            });

            if (jenkinsEndpoint === null) {
                asyncCallback('Cannot find required information in the job to download the Jenkins artifact: ' + jenkinsDetails.connectionName);
            }

            var artifactDownloadFolder: string = path.join(artifactsFolder, artifactDefinition.name);
            utilm.ensurePathExists(artifactDownloadFolder).then(() => {
                context.info('Created artifact folder: ' + artifactDownloadFolder);

                var zipSource = path.join(artifactDownloadFolder, 'download.zip');
                var fileStream: NodeJS.WritableStream = fs.createWriteStream(zipSource);
                var creds: baseifm.IBasicCredentials = <baseifm.IBasicCredentials>{};
                creds.username = this.getAuthParameter(jenkinsEndpoint, 'username');
                creds.password = this.getAuthParameter(jenkinsEndpoint, 'password');
                var jenkinsApi = new webapim.WebApi(jenkinsEndpoint.url, cm.basicHandlerFromCreds(creds)).getJenkinsApi();
                jenkinsApi.getArtifactContentZip(jenkinsDetails.jobName, artifactDefinition.version.toString(), jenkinsDetails.relativePath, (err, statusCode, res) => {
                    if (err) {
                        context.info('Error downloading artifact: ' + artifactDefinition.name);
                        asyncCallback(err);
                    }
                    else if (statusCode > 299) {
                        asyncCallback("Failed Request: " + statusCode);
                    }
                    res.pipe(fileStream);
                    fileStream.on('finish', function () {
                        cm.extractFile(zipSource, artifactDownloadFolder, (err) => {
                            if (err) {
                                context.info('Error extracting artifact: ' + artifactDefinition.name);
                                asyncCallback(err);
                                return;
                            }

                            shell.mv('-f', path.join(path.join(artifactDownloadFolder, 'archive'), '*'), artifactDownloadFolder);
                            shell.rm('-rf', zipSource, path.join(artifactDownloadFolder, 'archive'));
                            fileStream.end();
                            asyncCallback(err);
                            return;
                        });
                    });
                });
            });
        }
        catch (error) {
            context.info('There was problem in downloading the artifact: ' + artifactDefinition.name);
            asyncCallback(error);
        }
    }

    public getAuthParameter(endpoint: agentifm.ServiceEndpoint, paramName: string) {
        var paramValue = null;
        if (endpoint && endpoint.authorization && endpoint.authorization['parameters']) {
            paramValue = endpoint.authorization['parameters'][paramName];
        }

        return paramValue;
    }

}