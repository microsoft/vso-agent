
import scmm = require('./lib/scmprovider');
import gitm = require('./git');
import ctxm = require('../context');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

export function getProvider(ctx: ctxm.JobContext, targetPath: string): scmm.IScmProvider {
	return new GitTfsScmProvider(ctx, targetPath);
}

export class GitTfsScmProvider extends gitm.GitScmProvider {

	// override since TfsGit uses the generated OAuth token
	public initialize(endpoint: agentifm.ServiceEndpoint) {
		this.endpoint = endpoint;

	    if (endpoint.authorization && endpoint.authorization['scheme']) {
	        var scheme = endpoint.authorization['scheme'];
	        this.ctx.info('Using auth scheme: ' + scheme);

	        switch (scheme) {
	            case 'OAuth':
	                this.username = process.env['VSO_GIT_USERNAME'] || 'OAuth';
	                this.password = process.env['VSO_GIT_PASSWORD'] || this.getAuthParameter(endpoint, 'AccessToken') || 'not supplied';
	                break;

	            default:
	                this.ctx.warning('invalid auth scheme: ' + scheme);
	        }
	    }		
	}


}
