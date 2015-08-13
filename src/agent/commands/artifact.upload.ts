/// <reference path="../definitions/vso-node-api.d.ts" />

import ctxm = require('../context');
import cm = require('../common');
import Q = require('q');
import cmdm = require('./command');
import webapim = require('vso-node-api/WebApi');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import fc = require('../filecontainerhelper');

export function createAsyncCommand(taskCtx: ctxm.TaskContext, command: cm.ITaskCommand) {
	return new ArtifactUploadCommand(taskCtx, command);
}

export class ArtifactUploadCommand implements cm.IAsyncCommand {
	constructor(taskCtx: ctxm.TaskContext, command: cm.ITaskCommand) {
		this.command = command;
		this.taskCtx = taskCtx;
		this.description = "Upload a build artifact";
	}

	public command: cm.ITaskCommand;
	public description: string;
	public taskCtx: ctxm.TaskContext;

    public runCommandAsync() {
		var artifactName = this.command.properties["artifactname"];
		var containerFolder = this.command.properties["containerfolder"];
		
		if (!containerFolder) {;
            return Q.reject(new Error("No container folder specified."))
        }
        else if (containerFolder.charAt(0) !== "/") {
            containerFolder = "/" + containerFolder;
        }

		var localPath = this.command.properties["localpath"];
		var containerId = parseInt(this.taskCtx.variables[ctxm.WellKnownVariables.containerId]);

		this.command.info('artifactName: ' + artifactName);
		this.command.info('containerFolder: ' + containerFolder);
		this.command.info('localPath: ' + localPath);

		this.command.info('Uploading contents...');
		this.command.info(<any>fc.copyToFileContainer);
        return fc.copyToFileContainer(this.taskCtx, localPath, containerId, containerFolder).then((artifactLocation: string) => {
			this.command.info('Associating artifact ' + artifactLocation + ' ...');
		
			var buildId: number = parseInt(this.taskCtx.variables[ctxm.WellKnownVariables.buildId]);
			var artifact: buildifm.BuildArtifact = <buildifm.BuildArtifact>{
				name: artifactName,
				resource: {
					type: "container",
					data: artifactLocation
				}
			};
			
			var webapi = new webapi(this.taskCtx.service.collectionUrl, this.taskCtx.authHandler);
			var buildClient = webapi.getQBuildApi(this.taskCtx.service.collectionUrl, this.taskCtx.authHandler);
			return buildClient.postArtifact(this.taskCtx.variables[ctxm.WellKnownVariables.projectId], buildId, artifact);
		});
	}
}
