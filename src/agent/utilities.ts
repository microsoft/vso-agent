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

import ctxm = require('./context');

//
// Utilities passed to each task
// which provides contextual logging to server etc...
//
export class Utilities {
	constructor(context: ctxm.Context) {
		this.ctx = context;
	}

	private ctx: ctxm.Context;

    // spawn a process with stdout/err piped to context's logger
	// callback(err)
	public spawn(name: string, args: string[], options, callback) {
		var failed = false;
		options = options || {};

		var ops = {
			cwd: process.cwd(),
			env: process.env,
			failOnStdErr: true 
		};

		// write over specified options over default options (ops)
		for (var op in options) {
			ops[op] = options[op];
		}

        this.ctx.info('cwd: ' + ops.cwd);
        this.ctx.info(name + ' ' + args);

		var cp = require('child_process').spawn;

		var runCP = cp(name, args, ops);

		runCP.stdout.on('data', (data) => { 			
		  	this.ctx.info(data.toString('utf8'));
		});

		runCP.stderr.on('data', (data) => {
			failed = ops.failOnStdErr;
			if (ops.failOnStdErr) {
		        this.ctx.error(data.toString('utf8'));
			} else {
				this.ctx.info(data.toString('utf8'));
			}
		});

		runCP.on('exit', (code) => {
            if (failed) {
                callback(new Error('Failed with Error Output'));
                return;
            }

            if (code == 0) {
                callback();
            } else {                
                var msg = 'Return code: ' + code;
                this.ctx.error(msg);

                callback(new Error(msg));
            }
		});			
	}	
}