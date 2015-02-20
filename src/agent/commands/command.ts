import ctxm = require('../context');
import cm = require('../common');
import path = require('path');
import shell = require('shelljs');

//
// Command Format:
//    ##vso[artifact.command key=value;key=value]user message
//    
// Examples:
//    ##vso[task.progress value=58]
//    ##vso[task.issue type=warning;]This is the user warning message
//

export interface ITaskCommand {
	command: string;
	properties: { [name: string]: string };
	message: string;
}

export function parseCommand(commandLine: string): ITaskCommand {
    var preLen = cm.CMD_PREFIX.length;
    var lbPos = commandLine.indexOf('[');
    var rbPos = commandLine.indexOf(']');

    if (lbPos == -1 || rbPos == -1 || rbPos - lbPos < 3) {
        throw new Error('Invalid command brackets');
    }

    var cmdInfo = commandLine.substring(lbPos + 1, rbPos);
    var cmdParts = cmdInfo.trim().split(' ');
    var command = cmdParts[0];

    var properties = <{ [name: string]: string }>{};
    if (cmdParts.length == 2) {
        var propLines = cmdParts[1].split(';');
        
        propLines.forEach(function (propLine) {
            var propParts = propLine.trim().split('=');
            if (propParts.length != 2) {
                throw new Error('Invalid property: ' + propLine);
            }

            properties[propParts[0]] = propParts[1];
        });
    }

    var msg = commandLine.substring(rbPos + 1);
    
    var cmd:ITaskCommand = <ITaskCommand>{};
    cmd.command = command;
    cmd.message = msg;
    cmd.properties = properties;
    return cmd;
}

//
// TODO (bryanmac): will we need async cmds with callbacks?  
//                  Right now, all go to context, queue and return immediately

export function handleCommand(commandLine: string, taskCtx: ctxm.TaskContext) {
	var cmd: ITaskCommand = <ITaskCommand>{};
	try {
		cmd = parseCommand(commandLine);	
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