
import scmm = require('./lib/scmprovider');
import gitm = require('./git');
import ctxm = require('../context');
import cm = require('../common');

export function getProvider(ctx: ctxm.JobContext, targetPath: string): cm.IScmProvider {
	return new gitm.GitScmProvider(ctx, targetPath);
}
