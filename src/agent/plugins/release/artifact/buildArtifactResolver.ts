// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import common = require('../../../common');
import utilm = require('../../../utilities');
import path = require('path');
import fs = require('fs');
import Q = require('q');
import cm = require('../../../common');
import webapim = require('vso-node-api/WebApi');
import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import buildIfm = require('vso-node-api/interfaces/BuildInterfaces')
var shell = require('shelljs');

export class BuildArtifactResolver {
    public resolve(context: common.IExecutionContext,
        buildDetails: releaseIfm.AgentTfsBuildArtifactDetails,
        buildArtifact: buildIfm.BuildArtifact,
        buildId: number,
        artifactFolder: string): Q.Promise<void> {
        var defer = Q.defer<void>();

        var artifactDownloadFolder: string = path.join(artifactFolder, buildArtifact.name);
        if (buildArtifact.resource.type === undefined && buildArtifact.id === 0 || buildArtifact.resource.type.toLowerCase() === 'filepath') {
            utilm.ensurePathExists(artifactDownloadFolder).then(() => {
                var fileShare = buildArtifact.id === 0 ? buildArtifact.resource.data : path.join(buildArtifact.resource.data, buildArtifact.name);
                shell.cp('-rf', path.join(fileShare, '*'), artifactDownloadFolder);
                var errorMessage = shell.error();
                if (errorMessage) {
                    context.info('Error while downloading artifact: ' + buildArtifact.name + ' (Source location: ' + fileShare + ')');
                    defer.reject(errorMessage);
                    return;
                }
            }).fail((err) => {
                defer.reject(err);
                return;
            });
        }
        else if (buildArtifact.resource.type.toLowerCase() === 'container') {
            var serverUrl = context.jobInfo.jobMessage.environment.systemConnection.url;
            var buildClient = new webapim.WebApi(serverUrl, context.jobInfo.systemAuthHandler).getBuildApi();
            var zipFilePath = artifactDownloadFolder + '.zip';
            buildClient.getArtifactContentZip(buildId, buildArtifact.name, buildDetails.project, (err, statusCode, res) => {
                if (err) {
                    defer.reject(err);
                    return;
                }

                var fileStream: NodeJS.WritableStream = fs.createWriteStream(zipFilePath);
                res.pipe(fileStream);
                fileStream.on('finish', function () {
                    cm.extractFile(artifactDownloadFolder + '.zip', artifactFolder, (err) => {
                        if (err) {
                            context.info('Error extracting artifact: ' + buildArtifact.name);
                            defer.reject(err);
                            return;
                        }

                        shell.rm('-rf', artifactDownloadFolder + '.zip');
                        var errorMessage = shell.error();
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

        return defer.promise;
    }
}