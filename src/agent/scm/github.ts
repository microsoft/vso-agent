
import scmm = require('./lib/scmprovider');
import gitm = require('./git');
import cm = require('../common');

export function getProvider(ctx: cm.IExecutionContext, targetPath: string): cm.IScmProvider {
	return new gitm.GitScmProvider(ctx, targetPath);
}
