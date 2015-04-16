import cmdm = require('./command');
import ctxm = require('../context');
import cm = require('../common');

export function createSyncCommand(command: cm.ITaskCommand) {
	return new TaskDebugCommand(command);
}

export class TaskDebugCommand implements cm.ISyncCommand {
	constructor(command: cm.ITaskCommand) {
		this.command = command;
	}

	public command: cm.ITaskCommand;
	public runCommand(taskCtx: ctxm.TaskContext) {
	    if (this.command.message) {
	        taskCtx.verbose(this.command.message);    
	    }
	}
}
