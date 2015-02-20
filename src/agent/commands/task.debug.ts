import cmdm = require('./command');
import ctxm = require('../context');

export function runCommand(command: cmdm.ITaskCommand, taskCtx: ctxm.TaskContext) {
    if (command.message) {
        taskCtx.verbose(command.message);    
    }
}
