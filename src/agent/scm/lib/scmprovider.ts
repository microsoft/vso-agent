import Q = require('q');
import shell = require('shelljs');

export interface IScmProvider {
	username: string;
	password: string;

	// virtual - must override
	getCode (): Q.Promise<void>;
}

export class ScmProvider implements IScmProvider {
	constructor(targetPath: string) {
		this.targetPath = targetPath;
	}

	public username: string;
	public password: string;

	// full path of final root of enlistment
	public targetPath: string;

	public enlistmentExists(): boolean {
		return shell.test('-d', this.targetPath);
	}

	// virtual - must override
	public getCode (): Q.Promise<void> {
		var defer = Q.defer<void>();
		defer.reject(new Error('Must override the getCode method'));
		// defer.resolve(null);
		return defer.promise;
	}

	// virtual - must override
	public clean (): Q.Promise<void> {
		var defer = Q.defer<void>();
		defer.reject(new Error('Must override the getCode method'));
		// defer.resolve(null);
		return defer.promise;
	}	
}