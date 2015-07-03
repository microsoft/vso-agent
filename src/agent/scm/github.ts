
import scmm = require('./lib/scmprovider');
import gitm = require('./git');
import ctxm = require('../context');

export function getProvider(ctx: ctxm.JobContext, targetPath: string): scmm.IScmProvider {
	return new gitm.GitScmProvider(ctx, targetPath);
}
