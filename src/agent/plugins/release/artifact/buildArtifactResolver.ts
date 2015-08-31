// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import context = require('../../../context');
import utilm = require('../../../utilities');
import path = require('path');
import fs = require('fs');
import cm = require('../../../common');
import webapim = require('vso-node-api/WebApi');
import releaseIfm = require('vso-node-api/interfaces/ReleaseManagementInterfaces');
import buildIfm = require('vso-node-api/interfaces/BuildInterfaces')
var shell = require('shelljs');

export class BuildArtifactResolver {
    public resolve(context: context.JobContext,
        buildDetails: releaseIfm.AgentTfsBuildArtifactDetails,
        buildArtifact: buildIfm.BuildArtifact,
        buildId: number,
        artifactsFolder: string,
        asyncCallback2): void {

        var artifactDownloadFolder: string = path.join(artifactsFolder, buildArtifact.name);
        if (buildArtifact.resource.type === undefined && buildArtifact.id === 0 || buildArtifact.resource.type.toLowerCase() === 'filepath') {
            utilm.ensurePathExists(artifactDownloadFolder).then(() => {
                var fileShare = buildArtifact.id === 0 ? buildArtifact.resource.data : path.join(buildArtifact.resource.data, buildArtifact.name);
                try {
                    shell.cp('-rf', path.join(fileShare, '*'), artifactDownloadFolder);
                    asyncCallback2();
                }
                catch (error) {
                    context.info('Error while downloading artifact: ' + buildArtifact.name + ' (Source location: ' + fileShare + ')');
                    asyncCallback2(error);
                }
            }).fail((err) => {
                asyncCallback2(err);
                return;
            });
        }
        else if (buildArtifact.resource.type.toLowerCase() === 'container') {
            var serverUrl = context.job.environment.systemConnection.url;
            var buildClient = new webapim.WebApi(serverUrl, context.jobInfo.systemAuthHandler).getBuildApi();
            var zipFilePath = artifactDownloadFolder + '.zip';
            buildClient.getArtifactContentZip(buildId, buildArtifact.name, buildDetails.project, (err, statusCode, res) => {
                if (err) {
                    asyncCallback2(err);
                    return;
                }

                var fileStream: NodeJS.WritableStream = fs.createWriteStream(zipFilePath);
                res.pipe(fileStream);
                fileStream.on('finish', function () {
                    cm.extractFile(artifactDownloadFolder + '.zip', artifactsFolder, (err) => {
                        if (err) {
                            context.info('Error extracting artifact: ' + buildArtifact.name);
                            asyncCallback2(err);
                            return;
                        }

                        shell.rm('-rf', artifactDownloadFolder + '.zip');
                        fileStream.end();
                        asyncCallback2(err);
                        return;
                    });
                });
            });
        }
    }
}