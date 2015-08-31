/// <reference path="./definitions/Q.d.ts" />
/// <reference path="./definitions/node.d.ts"/>
/*
import events = require('events');
import cm = require('./common');
import Q = require('q');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

export interface IJobStep {
	id: string;
	displayName: string;
	continueOnError: boolean;
	alwaysRun: boolean;
	result: agentifm.TaskResult;
	run(): Q.Promise<agentifm.TaskResult>;
}

class JobStep implements IJobStep {
	public id: string;
	public displayName: string;
	public continueOnError: boolean;
	public alwaysRun: boolean;
	// engine sets
	public result: agentifm.TaskResult;

	constructor(id: string, displayName: string, continueOnError: boolean, alwaysRun: boolean) {
		this.id = id;
		this.displayName = displayName;
		this.continueOnError = continueOnError;
		this.alwaysRun = alwaysRun;
	}

	public run(): Q.Promise<agentifm.TaskResult> {
		var defer = Q.defer();
		defer.resolve(this.result);

		return <Q.Promise<agentifm.TaskResult>>defer.promise;		
	}
}

export class StepRunner extends events.EventEmitter {
	constructor() {
		this.steps = [];
		this.succeededCount = 0;
		this.withIssuesCount = 0;
		this.failedCount = 0;
		this.skippedCount = 0;
		this._hasFailed = false;
		this._result = agentifm.TaskResult.Succeeded;
		super();
	}

	public steps: IJobStep[];
	public succeededCount: number;
	public failedCount: number;
	public skippedCount: number;
	public withIssuesCount: number;

	private _result: agentifm.TaskResult;
	private _hasFailed: boolean;

	public addStep(step: IJobStep) {
		step.result = agentifm.TaskResult.Skipped;
		this.steps.push(step);
	}

	public run(): Q.Promise<agentifm.TaskResult> {
		return cm.execAll(this.runStep, this.steps, this)
		.then(() => {
			return this._result;
		})
		.fail((err) => {
			// TODO: unhandled
			console.error('Error Occurred:' + err.message);
		})
	}

	public runStep(step: IJobStep, state: any) {

		if (state._hasFailed && !step.alwaysRun) {
			//skip
			++state.skippedCount;
			return Q(null);
		}

		state.emit('stepStart', step);
		return step.run()
		.then((result: agentifm.TaskResult) => {
			
			if (result == agentifm.TaskResult.Failed && !step.continueOnError) {
				// update cumulative result
				state._result = agentifm.TaskResult.Failed;

				state._hasFailed = true;
			}

			if (result == agentifm.TaskResult.Failed && step.continueOnError) {
				// update cumulative result
				if (state._result == agentifm.TaskResult.Succeeded) {
					state._result = agentifm.TaskResult.SucceededWithIssues;	
				}
				
				result = agentifm.TaskResult.SucceededWithIssues;
			}

			step.result = result;

			switch (step.result) {
				case agentifm.TaskResult.Succeeded:
					++state.succeededCount;
					break;
				case agentifm.TaskResult.SucceededWithIssues:
					++state.withIssuesCount;
					break;					
				case agentifm.TaskResult.Failed:
					++state.failedCount;
					break;
				case agentifm.TaskResult.Skipped:
					++state.skippedCount;
					break;
				default:
					console.error('Unexpected TaskResult: ' + step.result);
			}

			state.emit('stepDone', step);			
		});
	}	
}*/