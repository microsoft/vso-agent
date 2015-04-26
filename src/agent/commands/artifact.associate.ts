import ctxm = require('../context');
import cm = require('../common');
import Q = require('q');
import cmdm = require('./command');
import webapi = require('../api/webapi');
import ifm = require('../api/interfaces');

export function createAsyncCommand(taskCtx: ctxm.TaskContext, command: cm.ITaskCommand) {
	return new ArtifactAssociateCommand(taskCtx, command);
}

export class ArtifactAssociateCommand implements cm.IAsyncCommand {
	constructor(taskCtx: ctxm.TaskContext, command: cm.ITaskCommand) {
		this.command = command;
		this.taskCtx = taskCtx;
		this.description = "Associate an artifact with a build";
	}

	public command: cm.ITaskCommand;
	public description: string;
	public taskCtx: ctxm.TaskContext;

	public runCommandAsync() {
		var artifactName = this.command.properties["artifactname"];
		var artifactType = this.command.properties["artifacttype"];
		var artifactLocation = this.command.properties["artifactlocation"];

		this.command.info('artifactName: ' + artifactName);
		this.command.info('artifactType: ' + artifactType);
		this.command.info('artifactLocation: ' + artifactLocation);

		this.command.info('Associating artifact...');
		
		var buildId: number = parseInt(this.taskCtx.variables[ctxm.WellKnownVariables.buildId]);
		var artifact: ifm.BuildArtifact = {
			name: artifactName,
			resource: {
				type: artifactType,
				data: artifactLocation
			}
		};
		
		var buildClient = webapi.QBuildApi(this.taskCtx.service.collectionUrl, this.taskCtx.authHandler);
		return buildClient.postArtifact(this.taskCtx.variables[ctxm.WellKnownVariables.projectId], buildId, artifact);
	}	
}
