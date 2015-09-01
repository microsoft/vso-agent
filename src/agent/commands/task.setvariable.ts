import ctxm = require('../context');
import cm = require('../common');

export function createSyncCommand(command: cm.ITaskCommand) {
    return new TaskSetVariableCommand(command);
}

export class TaskSetVariableCommand implements cm.ISyncCommand {
    constructor(command: cm.ITaskCommand) {
        this.command = command;
    }

    public command: cm.ITaskCommand;
    public runCommand(taskCtx: ctxm.TaskContext) {
        if (!this.command.properties || !this.command.properties['variable']) {
            taskCtx.warning('command setvariable variable not set');
            return;
        }

        var varName = this.command.properties['variable'];
        var varVal = this.command.message || '';

        taskCtx.jobInfo.jobMessage.environment.variables[varName] = varVal;
    }
}