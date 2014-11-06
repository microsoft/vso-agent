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
var shell = require('shelljs/global');
var fs = require('fs');

exports.execute = function(ctx, callback) {
	
	var cmakePath = which('cmake');
	if (!cmakePath) {
		callback(new Error('cmake not found'));
		return;
	}

	ctx.verbose('using cmake: ' + cmakePath);

	var args = [];

	var argsInput = ctx.inputs.args;
	ctx.verbose('argsInput: ' + argsInput);
	if (argsInput && argsInput.length > 0) {
		args = args.concat(ctx.util.argStringToArray(argsInput));
	}

	var cwd = ctx.inputs.cwd;
	ctx.verbose('working: ' + cwd);

	if (!fs.existsSync(cwd)) {
		callback(new Error('working does not exist: ' + cwd));	
		return;
	}
	cd(cwd);

	var cwd = process.cwd();
	ctx.info('Calling cmake');
	ctx.util.spawn(cmakePath, args, { cwd: cwd, failOnStdErr: false }, callback);
}
