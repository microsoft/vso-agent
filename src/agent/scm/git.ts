import Q = require('q');
import scmm = require('./lib/scmprovider');
import gitwm = require('./lib/gitwrapper');
import ctxm = require('../context');
import ifm = require('../api/interfaces');
var path = require('path');
var tl = require('vso-task-lib');
var url = require('url');

export function getProvider(ctx: ctxm.JobContext, targetPath: string): scmm.IScmProvider {
	return new GitScmProvider(ctx, targetPath);
}

function _translateRef(ref) {
    var brPre = 'refs/heads/';
    if (ref.startsWith(brPre)) {
        ref = 'refs/remotes/origin/' + ref.substr(brPre.length, ref.length - brPre.length);
    }

    return ref;
}

// TODO: take options with stdout and stderr streams for testing?

export class GitScmProvider extends scmm.ScmProvider {
	constructor(ctx: ctxm.JobContext, targetPath: string) {
		this.gitw = new gitwm.GitWrapper();
		super(ctx, targetPath);
	}

	public username: string;
	public password: string;
	public gitw: gitwm.GitWrapper;
	public endpoint: ifm.JobEndpoint;

	public initialize(endpoint: ifm.JobEndpoint) {
		if (!endpoint) {
			throw (new Error('endpoint null initializing git scm provider'));
		}

	    if (endpoint.authorization && endpoint.authorization['scheme']) {
	        var scheme = endpoint.authorization['scheme'];
	        this.ctx.info('Using auth scheme: ' + scheme);

	        switch (scheme) {
	            case 'OAuth':
	                this.username = 'OAuth';
	                this.password = endpoint.authorization['parameters']['AccessToken'];
	                break;

	            default:
	                this.ctx.warning('invalid auth scheme: ' + scheme);
	        }
	    }		
	}

	public getCode(): Q.Promise<number> {
		if (!this.endpoint) {
			throw (new Error('endpoint not set.  initialize not called'));
		}

        // encodes projects and repo names with spaces
        var gu = url.parse(this.endpoint.url);
        var giturl = gu.format(gu);
        var folder = path.dirname(this.targetPath);

        // figure out ref
	    var srcVersion = this.ctx.job.environment.variables['build.sourceVersion'];
	    var srcBranch = this.ctx.job.environment.variables['build.sourceBranch'];
	    this.ctx.info('srcVersion: ' + srcVersion);
	    this.ctx.info('srcBranch: ' + srcBranch);

	    
	    var selectedRef = srcVersion ? srcVersion : srcBranch;
	    this.ctx.info('selectedRef: ' + selectedRef);

	    var inputref = "refs/heads/master";
	    if (selectedRef && selectedRef.trim().length > 0) {
	        inputref = selectedRef;
	    }

	    // if branch, we want to clone remote branch name to avoid tracking etc.. ('/refs/remotes/...')
	    var ref = _translateRef(inputref);
	    this.ctx.info('Using ref: ' + ref);

        return Q(0)
        .then((code: number) => {
	        if (this.enlistmentExists()) {
	        	return this.gitw.clone(giturl, true, folder);
	        }
	        else {
	        	return this.gitw.fetch()
	        	.then((code: number) => {
	        		return this.gitw.checkout(ref);
	        	})
	        }
        })
        .then((code: number) => {
        	if (this.endpoint.data['checkoutSubmodules'] === "True") {
        		return this.gitw.submodule(['init'])
        		.then((code: number) => {
        			return this.gitw.submodule(['update']);
        		})
        	}
        	else {
        		return Q(0);
        	}
        })

		// security delete-internet-password -s <account>.visualstudio.com

	}

	public clean(): Q.Promise<number> {
		return this.gitw.exec(['clean', '-fdx']);
	}	

}