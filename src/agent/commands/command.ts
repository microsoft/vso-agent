import ctxm = require('../context');
import cm = require('../common');
import path = require('path');
import shell = require('shelljs');
var vsotask = require('vso-task-lib');

export interface ITaskCommand {
    command: string;
    properties: { [name: string]: string };
    message: string;
}

//
// TODO (bryanmac): will we need async cmds with callbacks?  
//                  Right now, all go to context, queue and return immediately

export function handleCommand(commandLine: string, taskCtx: ctxm.TaskContext) {
	var cmd: ITaskCommand;

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

	if (!cmdm.runCommand) {
		taskCtx.verbose('Command does not implement runCommand: ' + cmd.command);
		return;
	}

	cmdm.runCommand(cmd, taskCtx);
}