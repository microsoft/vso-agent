import ctxm = require('../context');
import cm = require('../common');

export function createSyncCommand(command: cm.ITaskCommand) {
	return new TaskIssueCommand(command);
}

export class TaskIssueCommand implements cm.ISyncCommand {
	constructor(command: cm.ITaskCommand) {
		this.command = command;
	}

	public command: cm.ITaskCommand;
	public runCommand(taskCtx: ctxm.TaskContext) {
		if (!this.command.properties || !this.command.properties['type']) {
			taskCtx.warning('command issue type not set');
			return;
		}

		switch (this.command.properties['type'].toLowerCase()) {
			case "error":
				taskCtx.error(this.command.message);
				break;
			
			case "warning":
				taskCtx.warning(this.command.message);
				break;

			default:
				taskCtx.warning('Invalid command issue type: ' + this.command.properties['type']);
				break;
		}
	}
}