// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/node.d.ts"/>

import fs = require('fs');
import path = require('path');
import os = require("os");
import cm = require('./common');
import fm = require('./feedback');
import events = require('events');
import Q = require('q');
var shell = require('shelljs');
var async = require('async');

//
// Synchronous FileLogWriter
// This is a synchronous client app running synchronous tasks so not an issue. 
// Would not want to use this on a server
//
export class DiagnosticFileWriter implements cm.IDiagnosticWriter {
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

export class RollingDiagnosticFileWriter implements cm.IDiagnosticWriter {
    constructor(level: cm.DiagnosticLevel, folder: string, filenamePrefix: string, settings: cm.ILogSettings) {
        this.level = level;
        this._folder = folder;
        this._filenamePrefix = filenamePrefix;
        this._maxLinesPerFile = settings.linesPerFile;
        this._filesToKeep = settings.maxFiles;
        
        this._initializeFileQueue();
    }
    
    public level: cm.DiagnosticLevel;
    private _folder: string;
    private _filenamePrefix: string;
    private _fileDescriptor: number;
    private _lineCount: number = 0;
    private _maxLinesPerFile: number;
    private _filesToKeep: number;
    private _fileQueue: string[];
    private _previouslyGeneratedFilename: string;
    private _uniqueFileCounter: number = 1;
    
    public write(message: string): void {
        var fileDescriptor = this._getFileDescriptor();
        fs.writeSync(fileDescriptor, message);
        if (message) {
            // count newlines
            this._lineCount += message.split('\n').length - 1;
        }
    }
    
    public writeError(message: string): void {
        this.write(message);
    }
    
    public end(): void {
        if (this._fileDescriptor) {
            fs.closeSync(this._fileDescriptor);
        }
    }
    
    private _getFileDescriptor(): number {
        if (this._fileDescriptor && this._lineCount >= this._maxLinesPerFile) {
            // close the current file
            fs.closeSync(this._fileDescriptor);
            this._fileDescriptor = undefined;
        }
        
        if (!this._fileDescriptor) {
            // create a new file and reset the line count
            var filename = this._generateFilename();
            this._lineCount = 0;
            this._fileDescriptor = fs.openSync(filename, 'a');
            
            // add the filename to the queue and delete any old ones
            this._fileQueue.push(filename);
            while (this._fileQueue.length > this._filesToKeep) {
                fs.unlinkSync(this._fileQueue.splice(0, 1)[0]);
            }
        }
        
        return this._fileDescriptor;
    }
    
    private _generateFilename(): string {
        var datePart = new Date().toISOString().replace(/:/gi, '_');
        var filename = this._filenamePrefix + '_' + process.pid + '_' + datePart;
        
        if (filename === this._previouslyGeneratedFilename) {
            filename += '_' + this._uniqueFileCounter++;
        }
        else {
            this._previouslyGeneratedFilename = filename;
            this._uniqueFileCounter = 1;
        }
        
        filename += '.log';
        return path.join(this._folder, filename);
    }
    
    private _initializeFileQueue(): void {
        if (fs.existsSync(this._folder)) {
            this._fileQueue = fs.readdirSync(this._folder).filter((filename: string) => {
                // get files that start with the prefix
                return filename.substr(0, this._filenamePrefix.length) == this._filenamePrefix;
            }).map((filename: string) => {
                // get last modified time
                return {
                    filename: filename,
                    lastModified: fs.statSync(path.join(this._folder, filename)).mtime.getTime()
                };
            }).sort((a, b) => {
                // sort by lastModified 
                return a.lastModified - b.lastModified;
            }).map((entry) => {
                return path.join(this._folder, entry.filename);
            });
            
            if (this._fileQueue.length > 0) {
                // open the most recent file and count the lines
                // these files should not be huge. if they become huge, and we need to stream them, we'll need to refactor
                var mostRecentFile = this._fileQueue[this._fileQueue.length - 1]; 
                var existingContents = fs.readFileSync(mostRecentFile).toString();
                var lineCount = existingContents.split(os.EOL).length;
                if (lineCount < this._maxLinesPerFile) {
                    // if the file isn't full, use it. if it is, we'll create a new one the next time _getFileDescriptor() is called
                    this._lineCount = lineCount;
                    this._fileDescriptor = fs.openSync(mostRecentFile, 'a');
                }
            }
        }
        else {
            shell.mkdir('-p', this._folder);
            shell.chmod(775, this._folder);
            this._fileQueue = [];
        }
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

export function getDefaultDiagnosticWriter(config: cm.IConfiguration, folder: string, prefix: string) {
    // default writer is verbose. it's rolling, so it shouldn't take up too much space
    return new RollingDiagnosticFileWriter(cm.DiagnosticLevel.Verbose,
        folder,
        prefix,
        config.settings.logSettings);
}