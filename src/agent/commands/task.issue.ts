import cmdm = require('./command');
import ctxm = require('../context');

export function runCommand(command: cmdm.ITaskCommand, taskCtx: ctxm.TaskContext) {

	switch (command.properties['type'].toLowerCase()) {
		case "error":
			taskCtx.error(command.message);
			break;
		
		case "warning":
			taskCtx.warning(command.message);
			break;

		default:
			taskCtx.warning('Invalid issue type: ' + command.properties['type']);
			break;
	}
}