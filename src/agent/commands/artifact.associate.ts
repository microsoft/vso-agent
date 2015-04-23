import ctxm = require('../context');
import cm = require('../common');
import Q = require('q');
import cmdm = require('./command');
import webapi = require('../api/webapi');
import ifm = require('../api/interfaces');

//
// Sample command async handler
// These will run in the background and get queued when cmd is called via stdout.
// The async commands queue will get drained before the task exits
// The done callback must get written.
// If the done callback passes an err, then it will fail the job
// If you want the command to be best effort, then eat any errors and don't callback with an err
//
// Output from this should call the output(line) callback.  Outback is buffered and written to the task log
// as one chunk so this output is not interleaved with other tool output.
//
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
		
		// backcompat with old server
		var job = (<any>this.taskCtx).job;
        var projectUrl: string = job.environment.systemConnection ? job.environment.systemConnection.url : job.authorization.serverUrl;
		projectUrl = projectUrl + '/' + this.taskCtx.variables[ctxm.WellKnownVariables.projectId]; 
		
		var buildClient = webapi.QBuildApi(projectUrl, cm.basicHandlerFromCreds(this.taskCtx.workerCtx.config.creds));
		return buildClient.postArtifact(buildId, artifact);
	}	
}
