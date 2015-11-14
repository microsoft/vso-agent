/// <reference path="../definitions/vso-node-api.d.ts" />

import ctxm = require('../context');
import cm = require('../common');
import Q = require('q');
import cmdm = require('./command');
import webapim = require('vso-node-api/WebApi');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import fc = require('../filecontainerhelper');

export function createAsyncCommand(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
	return new ArtifactUploadCommand(executionContext, command);
}

export class ArtifactUploadCommand implements cm.IAsyncCommand {
	constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
		this.command = command;
		this.executionContext = executionContext;
		this.description = "Upload a build artifact";
	}

	public command: cm.ITaskCommand;
	public description: string;
	public executionContext: cm.IExecutionContext;

    public runCommandAsync() {
		var artifactName = this.command.properties["artifactname"];
		var containerFolder = this.command.properties["containerfolder"];
		
		if (!containerFolder) {;
            return Q.reject(new Error("No container folder specified."))
        }
        else if (containerFolder.charAt(0) !== "/") {
            containerFolder = "/" + containerFolder;
        }

		var localPath = this.command.properties['localpath'] || this.command.message;
		var containerId = parseInt(this.executionContext.variables[ctxm.WellKnownVariables.containerId]);

		this.command.info('artifactName: ' + artifactName);
		this.command.info('containerFolder: ' + containerFolder);
		this.command.info('localPath: ' + localPath);

		this.command.info('Uploading contents...');
		this.command.info(<any>fc.copyToFileContainer);
        return fc.copyToFileContainer(this.executionContext, localPath, containerId, containerFolder).then((artifactLocation: string) => {
			this.command.info('Associating artifact ' + artifactLocation + ' ...');
		
			var buildId: number = parseInt(this.executionContext.variables[ctxm.WellKnownVariables.buildId]);
			var artifact: buildifm.BuildArtifact = <buildifm.BuildArtifact>{
				name: artifactName,
				resource: {
					type: "container",
					data: artifactLocation
				}
			};
			
			var webapi = this.executionContext.getWebApi();
			var buildClient = webapi.getQBuildApi();
			return buildClient.createArtifact(artifact, buildId, this.executionContext.variables[ctxm.WellKnownVariables.projectId]);
		});
	}
}
