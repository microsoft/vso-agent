/// <reference path="../definitions/vso-node-api.d.ts" />

import ctxm = require('../context');
import cm = require('../common');
import Q = require('q');
import cmdm = require('./command');
import webapim = require('vso-node-api/WebApi');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');

export function createAsyncCommand(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
	return new ArtifactAssociateCommand(executionContext, command);
}

export class ArtifactAssociateCommand implements cm.IAsyncCommand {
	constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
		this.command = command;
		this.executionContext = executionContext;
		this.description = "Associate an artifact with a build";
	}

	public command: cm.ITaskCommand;
	public description: string;
	public executionContext: cm.IExecutionContext;

	public runCommandAsync() {
		var artifactName = this.command.properties["artifactname"];
		var artifactType = this.command.properties["artifacttype"];
		var artifactLocation = this.command.message;

		this.command.info('artifactName: ' + artifactName);
		this.command.info('artifactType: ' + artifactType);
		this.command.info('artifactLocation: ' + artifactLocation);

		this.command.info('Associating artifact...');
		
		var buildId: number = parseInt(this.executionContext.variables[ctxm.WellKnownVariables.buildId]);
		var artifact: buildifm.BuildArtifact = <buildifm.BuildArtifact>{
			name: artifactName,
			resource: {
				type: artifactType,
				data: artifactLocation
			}
		};
		
		var webapi = this.executionContext.getWebApi();
		var buildClient = webapi.getQBuildApi();
		return buildClient.createArtifact(artifact, buildId, this.executionContext.variables[ctxm.WellKnownVariables.projectId]);
	}	
}
