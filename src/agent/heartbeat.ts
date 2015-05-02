var touch = require('touch');
var fs = require('fs');
var path = require('path');

//
// We write to a .lock file in the agent's root directory and update on the long poll loop (50 sec) so:
// - we can avoid starting up two agent process on the same working dir and config 
//   (running as svc and user starts interactive)
// - we can advise to not uninstall the service if it's running
// - we can advise to not update in place if it's running
// - if the agent turns into a zombie (missed callback, http call never returned etc...), host can kill it
//
var _lockPath = path.join(__dirname, '..', '.lock');

// sync is fine here because agent is in single message queue loop and config is synchronous

var CONSIDERED_DEAD_SEC = 5 * 60;

export function alive() {
	try {
		touch.sync(_lockPath);	
	}
	catch (err) {
		// go to service log
		console.error('failed to updated heartbeat. ' + err.message);
	}
}

export function stop() {
	try {
		fs.unlinkSync(_lockPath);
	}
	catch(err) {
		console.error('failed to remove heartbeat. ' + err.message);
		console.error('agent will not be able to start for ' + CONSIDERED_DEAD_SEC / 60 + ' minutes.');
	}
}

export function isAlive(): boolean {
	return lastHeartbeat() < CONSIDERED_DEAD_SEC;
}

export function lastHeartbeat(): number {
	if (!fs.existsSync(_lockPath)) {
		return CONSIDERED_DEAD_SEC + 1;
	}

	var stat = fs.statSync(_lockPath);
	return ((new Date()).getTime() - stat.mtime.getTime())/1000;
}

export function exitIfAlive() {
	if (isAlive()) {
	    console.error('Another agent process is running.  Exiting.');
	    process.exit(1);
	}	
}

