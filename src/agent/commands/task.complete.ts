import ctxm = require('../context');
import cm = require('../common');
import ifm = require('../api/interfaces');

export function createSyncCommand(command: cm.ITaskCommand) {
	return new TaskCompleteCommand(command);
}

export class TaskCompleteCommand implements cm.ISyncCommand {
	constructor(command: cm.ITaskCommand) {
		this.command = command;
	}

	public command: cm.ITaskCommand;
	public runCommand(taskCtx: ctxm.TaskContext) {
		if (this.command.message) {
			taskCtx.resultMessage = this.command.message;
		}

		var result = this.command.properties['result'];

		switch (result.toLowerCase()) {			
			case "failed":
				taskCtx.result = ifm.TaskResult.Failed;
				break;

			default:
				taskCtx.result = ifm.TaskResult.Succeeded;
				break;
		}
	}
}