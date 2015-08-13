import Q = require('q');
import shell = require('shelljs');
import ctxm = require('../../context');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

export interface IScmProvider {
	// virtual - must override
	initialize(endpoint: agentifm.ServiceEndpoint);
	getCode(): Q.Promise<number>;
	clean(): Q.Promise<number>;
}

export class ScmProvider implements IScmProvider {
	constructor(ctx: ctxm.JobContext, targetPath: string) {
		this.targetPath = targetPath;
		this.ctx = ctx;
	}

	public ctx: ctxm.JobContext;
	public debugOutput: boolean;

	// full path of final root of enlistment
	public targetPath: string;

	public enlistmentExists(): boolean {
		return shell.test('-d', this.targetPath);
	}

	public initialize(endpoint: agentifm.ServiceEndpoint) {
		// should override if you need store creds, info, etc.. from the endpoint
	}

	public getAuthParameter(endpoint: agentifm.ServiceEndpoint, paramName: string) {
		var paramValue = null;

		if (endpoint && endpoint.authorization && endpoint.authorization['parameters']) {
			paramValue = endpoint.authorization['parameters'][paramName];	
		}
		
		return paramValue;
	}
	
	// virtual - must override
	public getCode(): Q.Promise<number> {
		var defer = Q.defer<number>();
		defer.reject(new Error('Must override the getCode method'));
		// defer.resolve(null);
		return defer.promise;
	}

	// virtual - must override
	public clean(): Q.Promise<number> {
		var defer = Q.defer<number>();
		defer.reject(new Error('Must override the clean method'));
		// defer.resolve(null);
		return defer.promise;
	}	
}