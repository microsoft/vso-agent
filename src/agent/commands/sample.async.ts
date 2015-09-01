import ctxm = require('../context');
import cm = require('../common');
import Q = require('q');
import cmdm = require('./command');

//
// Sample command async handler
// These will run in the background and get queued when cmd is called via stdout.
// The async commands queue will get drained before the task exits
// The done callback must get written.
// If the done callback passes an err, then it will fail the job
// If you want the command to be best effort, then eat any errors and don't callback with an err
//
// Output from this should call the output(line) callback.  Outback is buffered and written to the task log
// as one chunk so this output is not interleaved with other tool output.
//
export function createAsyncCommand(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
	return new SampleAsyncCommand(executionContext, command);
}

export class SampleAsyncCommand implements cm.IAsyncCommand {
	constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
		this.command = command;
		this.executionContext = executionContext;
		this.description = "Sample Async Command";
	}

	public command: cm.ITaskCommand;
	public description: string;
	public executionContext: cm.IExecutionContext;

	public runCommandAsync() {
        var defer = Q.defer();

		this.command.info('running sample async command ...');
		this.command.warning('sample warning message');

		// an error does not fail the task - simply error highlighted in console and on build summary.  See below to fail task
		this.command.error('sample error message');

		setTimeout(() => {
			this.command.info('done running async command');

			// resolve or reject must get called!  In this sample, if you set result=fail, then it forces a failure
			if (this.command.properties && this.command.properties['result'] === 'fail') {

				// reject with an error will fail the task (and the build if not continue on error in definition)
				// if you don't want an error condition to fail the build, do command.error (above) and call resolve.
				defer.reject(new Error(this.command.message));
				return;
			}
			else {
				defer.resolve(null);
			}
		}, 2000);

		return defer.promise;
	}	
}
