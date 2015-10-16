import Q = require('q');
import shell = require('shelljs');
import path = require('path');
import ctxm = require('../../context');
import cm = require('../../common');
import crypto = require('crypto');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

export class ScmProvider implements cm.IScmProvider {
	constructor(ctx: cm.IExecutionContext, endpoint: agentifm.ServiceEndpoint) {
		this.ctx = ctx;
        this.endpoint = endpoint;
        this.job = ctx.jobInfo.jobMessage;
        this.variables = this.job.environment.variables       
	}

	public ctx: cm.IExecutionContext;
	public debugOutput: boolean;
	public endpoint: agentifm.ServiceEndpoint;
	public job: agentifm.JobRequestMessage;
    public variables: {[key: string]: string};
    public hashKey: string;
    
	// full path of final root of enlistment
	public targetPath: string;

	public enlistmentExists(): boolean {
		return shell.test('-d', this.targetPath);
	}

	// should override if you need to process/store creds from the endpoint
	public setAuthorization(authorization: agentifm.EndpointAuthorization) {

	}
    
    // override if it's more complex than just hashing the url
    public getHashKey() {
        var hash = null;
        
        if (this.endpoint.url) {
            var hashProvider = crypto.createHash("sha256");
            hashProvider.update(this.endpoint.url, 'utf8');
            hash = hashProvider.digest('hex');            
        }
 
        return hash;
    }

	public initialize() {
		if (!this.ctx) {
			throw (new Error('executionContext null initializing git scm provider'));
		}
                
		if (!this.endpoint) {
			throw (new Error('endpoint null initializing git scm provider'));
		}

        this.setAuthorization(this.endpoint.authorization);
        
        this.hashKey = this.getHashKey();
	}

	public getAuthParameter(authorization: agentifm.EndpointAuthorization, paramName: string) {
		var paramValue = null;

		if (authorization && authorization['parameters']) {
			paramValue = authorization['parameters'][paramName];	
		}
		
		return paramValue;
	}
	
	// virtual - must override
	public getCode(): Q.Promise<number> {
		var defer = Q.defer<number>();
		defer.reject(new Error('Must override the getCode method'));
		return defer.promise;
	}

	// virtual - must override
	public clean(): Q.Promise<number> {
		var defer = Q.defer<number>();
		defer.reject(new Error('Must override the clean method'));
		return defer.promise;
	}	
}