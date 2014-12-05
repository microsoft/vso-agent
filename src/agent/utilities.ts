// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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

    //
    // '-a -b "quoted b value" -c -d "quoted d value"' becomes
    // [ '-a', '-b', '"quoted b value"', '-c', '-d', '"quoted d value"' ]
    //
    public argStringToArray(argString: string): string[] {
        var args = argString.match(/([^" ]*("[^"]*")[^" ]*)|[^" ]+/g);	
        //remove double quotes from each string in args as child_process.spawn() cannot handle literla quotes as part of arguments
        for(var i = 0; i < args; i ++)
        {
            args[i] = args[i].replace(/"/g", "");
        }
        return args;
    }

    // spawn a process with stdout/err piped to context's logger
    // callback(err)
    public spawn(name: string, args: string[], options, callback: (err: any, returnCode: number) => void) {
        var failed = false;
        options = options || {};
        args = args || [];

        var ops = {
            cwd: process.cwd(),
            env: process.env,
            failOnStdErr: true,
            failOnNonZeroRC: true 
        };

        // write over specified options over default options (ops)
        for (var op in options) {
            ops[op] = options[op];
        }

        this.ctx.verbose('cwd: ' + ops.cwd);
        this.ctx.verbose('args: ' + args.toString());
        this.ctx.info('running: ' + name + ' ' + args.join(' '));

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
                callback(new Error('Failed with Error Output'), code);
                return;
            }

            if (code == 0 || !ops.failOnNonZeroRC) {
                callback(null, code);
            } else {                
                var msg = 'Return code: ' + code;
                this.ctx.error(msg);

                callback(new Error(msg), code);
            }
        });			
    }	
}