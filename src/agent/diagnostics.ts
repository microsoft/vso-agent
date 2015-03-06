// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/node.d.ts"/>

var fs = require('fs');
import path = require('path');
import os = require("os");
import cm = require('./common');
import fm = require('./feedback');
import events = require('events');
var shell = require('shelljs');
var async = require('async');

//
// Synchronouse FileLogWriter
// This is a synchronous client app running synchronous tasks so not an issue. 
// Would not want to use this on a server
//
export class DiagnosticFileWriter implements cm.IDiagnosticWriter  {
    
    constructor(level: cm.DiagnosticLevel, fullPath: string, fileName: string) {
        this.level = level;
        shell.mkdir('-p', fullPath);
        shell.chmod(775, fullPath);

        // TODO: handle failure cases.  It throws - Error: ENOENT, open '/nopath/somefile.log'
        //       we probably shouldn't handle - fail to start with good error - better than silence ...
        this._fd = fs.openSync(path.join(fullPath, fileName), 'a');  // append, create if not exist
    }

    public level: cm.DiagnosticLevel;
    private _fd: any;

    public write(message: string): void {
        fs.writeSync(this._fd, message);
    }

    public writeError(message: string): void {
        fs.writeSync(this._fd, message);
    }   

    divider() {
        this.write('----------------------------------------');
    }

    public end(): void {
        
    }               
}

export class DiagnosticConsoleWriter implements cm.IDiagnosticWriter {
    constructor(level: cm.DiagnosticLevel) {
        this.level = level;
    }

    public level: cm.DiagnosticLevel;

    public write(message: string): void {
        process.stdout.write(message, 'utf8');      
    }

    public writeError(message: string): void {
        process.stderr.write(message, 'utf8');
    }   

    public end(): void {
        
    }       
}

export class DiagnosticEmitter extends events.EventEmitter {
    constructor() {
        super();
    }
}

export class DiagnosticSweeper extends fm.TimedWorker  {
    constructor(path: string, ext:string, ageSeconds: number, intervalSeconds: number) {
        this.path = path;
        this.ageSeconds = ageSeconds;
        this.ext = ext;
        this.emitter = new DiagnosticEmitter();
        super(intervalSeconds * 1000);
    }

    public emitter: DiagnosticEmitter;
    public path: string;
    public ageSeconds: number;
    public ext: string;

    public on(event: string, listener: Function): events.EventEmitter {
        this.emitter.on(event, listener);
        return this.emitter;
    }

    public doWork(callback: (err: any) => void): void {
        this._cleanFiles(callback);
    }

    private _cleanFiles(callback: (err: any) => void): void {
        this.emitter.emit('info', 'Cleaning Files: ' + this.path);
        if (!shell.test('-d', this.path)) {
            callback(null);
            return;
        }

        var candidates = shell.find(this.path).filter((file) => { return this.ext === '*' || file.endsWith('.' + this.ext); });

        var _that = this;
        var delCount = 0;
        async.forEachSeries(candidates,
            function (candidate, done: (err: any) => void) {
                fs.stat(candidate, (err, stats) => {
                    if (err) {
                        done(null);
                        return;
                    }

                    if (stats.isDirectory()) {
                        done(null);
                        return;
                    }

                    var fileAgeSeconds = (new Date().getTime() - stats.mtime.getTime()) / 1000;
                    if (fileAgeSeconds > _that.ageSeconds) {
                        ++delCount;
                        _that.emitter.emit('deleted', candidate);
                        shell.rm(candidate);
                    }                    

                    // ignoring errors - log and keep going
                    done(null);
                })
            }, function (err) {
                _that.emitter.emit('info', 'deleted file count: ' + delCount);
                // ignoring errors. log and go
                callback(null);
            });        
    }
}

