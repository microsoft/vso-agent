// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var shell = require('shelljs');

export class GitRepo {

	private git: string;
	public repo: string;

	constructor(location: string) {
		this.repo = location;
		this.git = shell.which('git');
	}

	public init(callback: (err:any) => void) {
		this.execute(['init'], callback);
	}

	public add(path: string, callback: (err:any) => void) {
		this.execute(['add', path], callback);
	}

	public commit(message: string, addModified: boolean, callback: (err:any) => void) {
		var arguments = [];
		arguments.push('commit');
		arguments.push('-m');
		arguments.push(message);

		if (addModified) {
			arguments.push('-a');
		}

		this.execute(arguments, callback);
	}

	private execute(parameters: string[], callback: (err:any) => void) {
		var ops = {
			cwd: this.repo,
			env: process.env,
			failOnStdErr: true 
		};

		var cp = require('child_process').spawn;
		var runCP = cp(this.git, parameters, ops);

		// progress comes out on stderr so we write to stdout
		runCP.stderr.on('data', (data) => {
			console.log(data);
		});

		runCP.on('exit', (code) => {
            if (code == 0) {
                callback(null);
            } else {                
                var msg = 'Return code: ' + code;
                callback(new Error(msg));
            }
		});	
	}
}