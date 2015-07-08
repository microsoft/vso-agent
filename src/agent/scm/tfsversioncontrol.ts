import Q = require('q');
import scmm = require('./lib/scmprovider');
import gitwm = require('./lib/gitwrapper');
import ctxm = require('../context');

var tl = require('vso-task-lib');

export function getProvider(ctx: ctxm.JobContext, targetPath: string): scmm.IScmProvider {
	return new TfsvcScmProvider(ctx, targetPath);
}

function _translateRef(ref) {
    var brPre = 'refs/heads/';
    if (ref.startsWith(brPre)) {
        ref = 'refs/remotes/origin/' + ref.substr(brPre.length, ref.length - brPre.length);
    }

    return ref;
}

export class TfsvcScmProvider extends scmm.ScmProvider {
	constructor(ctx: ctxm.JobContext, targetPath: string) {

		super(ctx, targetPath);
	}

	// virtual - must override
	public getCode(): Q.Promise<number> {
		var defer = Q.defer<number>();
		defer.reject(new Error('TFS Version Control is not supported on xplat yet.'));
		// defer.resolve(null);
		return defer.promise;
	}

	// virtual - must override
	public clean(): Q.Promise<number> {
		var defer = Q.defer<number>();
		defer.reject(new Error('TFS Version Control is not supported on xplat yet.'));
		// defer.resolve(null);
		return defer.promise;
	}
}