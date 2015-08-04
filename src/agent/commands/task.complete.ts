/// <reference path="../definitions/vso-node-api.d.ts" />

import ctxm = require('../context');
import cm = require('../common');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

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
				taskCtx.result = agentifm.TaskResult.Failed;
				break;

			default:
				taskCtx.result = agentifm.TaskResult.Succeeded;
				break;
		}
	}
}