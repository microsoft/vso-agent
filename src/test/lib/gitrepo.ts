// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
//

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