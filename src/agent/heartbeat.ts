var fs = require('fs');
var path = require('path');
var shell = require('shelljs');

//
// Writing a pid file helps monitoring tools
// The agent will update the pid file every message loop (50 sec)
//
var _pidPath = path.join(__dirname, '..', '.pid');

export function write() {
	// sync not an issue here since it's written on a single message loop in the agent
	fs.appendFileSync(_pidPath, process.pid.toString(), { flag: 'w'});
}

export function stop() {
	if (shell.test('-f', _pidPath)) {
		shell.rm(_pidPath);
	}
}

export function lastHeartbeat(): number {
	if (!fs.existsSync(_pidPath)) {
		return -1;
	}

	var stat = fs.statSync(_pidPath);
	return ((new Date()).getTime() - stat.mtime.getTime())/1000;
}
