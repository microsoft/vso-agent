
import scmm = require('./lib/scmprovider');
import gitm = require('./git');
import cm = require('../common');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

export function getProvider(ctx: cm.IExecutionContext, endpoint: agentifm.ServiceEndpoint): cm.IScmProvider {
	return new GitTfsScmProvider(ctx, endpoint);
}

export class GitTfsScmProvider extends gitm.GitScmProvider {

	// override since TfsGit uses the generated OAuth token
	public setAuthorization(authorization: agentifm.EndpointAuthorization) {
		if (this.ctx.config.settings.basic) {
			this.ctx.info('Using cfgcreds');
			this.username = (<any>this.ctx.config).creds.username;
			this.password = (<any>this.ctx.config).creds.password;
		}
	    else if (authorization && authorization['scheme']) {
	        var scheme = authorization['scheme'];
	        this.ctx.info('Using auth scheme: ' + scheme);

	        switch (scheme) {
	        	case 'Basic':
	        		this.username = this.getAuthParameter(authorization, 'Username') || 'not supplied';
	        		this.password = this.getAuthParameter(authorization, 'Password') || 'not supplied';
	        		break;

	            case 'OAuth':
	                this.username = process.env['VSO_GIT_USERNAME'] || 'OAuth';
	                this.password = process.env['VSO_GIT_PASSWORD'] || 
	                				this.getAuthParameter(authorization, 'AccessToken') || 'not supplied';
	                break;
				
	            default:
	                this.ctx.warning('invalid auth scheme: ' + scheme);
	        }
	    }		
	}


}
