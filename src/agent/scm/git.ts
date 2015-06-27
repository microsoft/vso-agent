import Q = require('q');
import scmm = require('./lib/scmprovider');
import gitw = require('./lib/gitwrapper');

export class GitScmProvider extends scmm.ScmProvider {
	public getCode(): Q.Promise<void> {
		return gitw.exec();
	}

	public clean(): Q.Promise<void> {
		return gitw.exec('clean -fdx');
	}	
}