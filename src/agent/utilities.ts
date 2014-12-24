// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/Q.d.ts" />

import Q = require('q');
import ctxm = require('./context');

var shell = require('shelljs');
var fs = require('fs');

// TODO: offer these module level context-less helper functions in utilities below
export function ensurePathExists(path: string): Q.Promise<void> {
    var defer = Q.defer<void>();

    if (fs.exists(path, function(exists) {
        if (!exists) {
            shell.mkdir('-p', path);

            var errMsg = shell.error();

            if (errMsg) {
                defer.reject(new Error('Could not create path (' + path + '): ' + errMsg));
            }
            else {
                defer.resolve(null);
            }
        }
    }));

    return defer.promise;        
}

export function objectToFile(filePath: string, obj: any): Q.Promise<void> {
    var defer = Q.defer<void>();

    fs.writeFile(filePath, JSON.stringify(obj, null, 2), (err) => {
        if (err) {
            defer.reject(new Error('Could not save to file (' + filePath + '): ' + err.message));
        }
        else {
            defer.resolve(null);
        }
    });

    return defer.promise;        
}

//
// Utilities passed to each task
// which provides contextual logging to server etc...
// also contains general utility methods that would be useful to all task authors
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
        for(var i = 0; i < args.length; i ++)
        {
            args[i] = args[i].replace(/"/g, "");
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
