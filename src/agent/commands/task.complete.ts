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
	public runCommand(executionContext: cm.IExecutionContext) {
		if (this.command.message) {
			executionContext.resultMessage = this.command.message;
		}

		var result = this.command.properties['result'];

		switch (result.toLowerCase()) {			
			case "failed":
				executionContext.result = agentifm.TaskResult.Failed;
				break;

			default:
				executionContext.result = agentifm.TaskResult.Succeeded;
				break;
		}
	}
}