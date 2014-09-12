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

/// <reference path="./definitions/node.d.ts"/>

var fs = require('fs');
import path = require('path');
import os = require("os");
import cm = require('./common');
var shell = require('shelljs');

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

