import ctxm = require('../context');
import cm = require('../common');
import path = require('path');
import shell = require('shelljs');
var vsotask = require('vso-task-lib');

//
// TODO (bryanmac): will we need async cmds with callbacks?  
//                  Right now, all go to context, queue and return immediately

export function handleCommand(commandLine: string, taskCtx: ctxm.TaskContext) {
	var cmd: cm.ITaskCommand;

	try {
		cmd = vsotask.commandFromString(commandLine);	
	}
	catch(err) {
		taskCtx.warning(err.message + ': ' + commandLine);
		return;
	}

	var cmdModulePath = path.join(__dirname, cmd.command + '.js');
	if (!shell.test('-f', cmdModulePath)) {
		taskCtx.warning('command module does not exist: ' + cmd.command);
		return;
	}

	var cmdm = require('./' + cmd.command);

    if (cmdm.createSyncCommand) {
        var syncCmd = cmdm.createSyncCommand(cmd);
        syncCmd.runCommand(taskCtx);    
    }
    else if (cmdm.createAsyncCommand) {
        var asyncCmd = cmdm.createAsyncCommand(cmd);
        taskCtx.feedback.queueAsyncCommand(asyncCmd);
    }
    else {
        taskCtx.verbose('Command does not implement runCommand or runCommandAsync: ' + cmd.command);
    }
	
}