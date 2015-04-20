import ctxm = require('../context');
import cm = require('../common');

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
export function createAsyncCommand(taskCtx: ctxm.TaskContext, command: cm.ITaskCommand) {
	return new SampleAsyncCommand(taskCtx, command);
}

export class SampleAsyncCommand implements cm.IAsyncCommand {
	constructor(taskCtx: ctxm.TaskContext, command: cm.ITaskCommand) {
		this.command = command;
		this.taskCtx = taskCtx;
		this.description = "Sample Async Command";
	}

	public command: cm.ITaskCommand;
	public description: string;
	public taskCtx: ctxm.TaskContext;

	public runCommandAsync(output:(line) => void, 
                           done: (err: any) => void): void {

		output('running sample async command ...');
		setTimeout(function(){
			output('done running async command');

			// Done must get called!  In this sample, if you set result=fail, then it forces a failure
			if (this.command.properties && this.command.properties['result'] === 'fail') {
				done(new Error('forcing async command failure'));
				return;
			}

			done(null);
		}, 2000);	
	}	
}
