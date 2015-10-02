
import scmm = require('./lib/scmprovider');
import gitm = require('./git');
import cm = require('../common');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

export function getProvider(ctx: cm.IExecutionContext, endpoint: agentifm.ServiceEndpoint): cm.IScmProvider {
	return new gitm.GitScmProvider(ctx, endpoint);
}
