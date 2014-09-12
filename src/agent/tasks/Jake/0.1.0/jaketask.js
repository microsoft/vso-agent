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

var jake = require('jake')
  , fs = require('fs')
  , path = require('path')
  , shell = require('shelljs/global')
  , childProcess = require("child_process")
  , stream = require('stream');

exports.execute = function(ctx, callback) {
	var _buffer;

	var jakeWorking = path.resolve(ctx.inputs.cwd);
	ctx.info('Running Jake');
	ctx.info(process.cwd());
    if (!fs.existsSync(jakeWorking)) {
    	ctx.error('cwd: ' + ctx.inputs.cwd + ' does not exist. (' + jakeWorking + ')');
    	callback(new Error('cwd: ' + ctx.inputs.cwd + ' does not exist. (' + jakeWorking + ')'));
    }

	ctx.info('Running Jake:' + script);
	
	var args = []; 
	args.push(path.join(__dirname, 'jakerunner.js'));

	if (ctx.inputs.scriptName) {
		var script = path.join(jakeWorking, ctx.inputs.scriptName);
	    if (!fs.existsSync(script)) {
	    	ctx.error('scriptName: ' + ctx.inputs.scriptName + ' does not exist. (' + script + ')');
	    }

		args.push('-f');
		args.push(ctx.inputs.scriptName);
	}

	if (ctx.inputs.target) {
	    args.push(ctx.inputs.target);
	}

	var ops = {
		cwd: path.resolve(ctx.inputs.cwd),
		env: process.env
	};

	// calling spawn instead of fork so we can easily capture output --> logs	
	ctx.util.spawn('node', args, ops, callback);
}
