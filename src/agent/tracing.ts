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

var path = require('path');
var os = require('os');

import cm = require('./common');

export class Tracing {
	constructor(fullPath: string, writer: cm.ITraceWriter) {
		var ext = path.extname(fullPath);
		this.scope = path.basename(fullPath, ext);
		this.writer = writer;
	}

	public location: string;
	private scope: string;
	private writer: cm.ITraceWriter;

	public enter(location: string) {
		this.write(location + '>>>>>>>>>> ');
	}

	public callback(location: string) {
		this.write(location + '<<<<<<<<<< ');
	}

	public state(name: string, data: any) {
		this.write(name + ':' + JSON.stringify(data, null, 2));
	}

	public write(message: string) {
		if (!process.env[cm.envTrace]) {
	        return;
	    }

		this.writer.trace('[' + new Date().toISOString()  + '] ' + this.scope + ':' + '> ' + message + os.EOL);
	}
}
