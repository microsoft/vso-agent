
// TODO: convert vso-task-lib to TS and generate .d.ts file
var tl = require('vso-task-lib');

export var envGitUsername = 'GIT_USERNAME';
export var envGitPassword = 'GIT_PASSWORD';

export interface IGitExecOptions {
    cwd: string;
    env: { [key: string]: string };
    silent: boolean;
    outStream: WritableStream;
    errStream: WritableStream;
};

// TODO: move into vso-task-lib??
export class GitWrapper {
	public username: string;
	public password: string;

	public exec(argLine: string, options?: IGitExecOptions): Q.Promise<number> {
		var defer = Q.defer<number>();

		var gitPath = tl.which('git', false);
		if (!gitPath) {
			defer.reject(new Error('git not found in the path'));
			return;
		}

		var git = new tl.ToolRunner(gitPath);

		if (argLine) {
			git.arg(argLine, true); // raw arg
		}
		
		// TODO: if HTTP_PROXY is set (debugging) we can also supply http.proxy config
		// TODO: handle and test with spaces in the path

		if (this.username) {
			process.env[envGitUsername] = this.username;
			process.env[envGitPassword] = this.password || '';
			var credHelper = path.join(__dirname, 'credhelper.js');
			git.arg('-c credential.helper=' + credhelper, true); // raw arg
		}

        var ops: any = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: options.silent || false,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr,
            failOnStdErr: false,
            ignoreReturnCode: false
        };

		return git.exec(ops)
		.fin(() => {
			process.env[envGitUsername] = null;
			process.env[envGitPassword] = null;
		}); 
	}
}


// optional - no tasks will concat nothing
