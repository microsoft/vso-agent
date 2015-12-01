
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

	    if (authorization && authorization['scheme']) {
	        var scheme = authorization['scheme'];
			
			// override for on-prem
			if (this.ctx.config.settings.useConfigurationCredentials) {
				if (this.ctx.config && (<any>this.ctx.config).creds) {
					var altCreds = (<any>this.ctx.config).creds;
					process.env['VSO_GIT_USERNAME'] = altCreds.username;
					process.env['VSO_GIT_PASSWORD'] = altCreds.password;
				}
				else {
					this.ctx.warning('useConfigurationCredentials is specified but no alt creds are available');
				}
			}
			
	        this.ctx.info('Using auth scheme: ' + scheme);

	        switch (scheme) {
	            case 'OAuth':
	                this.username = process.env['VSO_GIT_USERNAME'] || 'OAuth';
	                this.password = process.env['VSO_GIT_PASSWORD'] || this.getAuthParameter(authorization, 'AccessToken') || 'not supplied';
	                break;
				
	            default:
	                this.ctx.warning('invalid auth scheme: ' + scheme);
	        }
	    }		
	}


}
