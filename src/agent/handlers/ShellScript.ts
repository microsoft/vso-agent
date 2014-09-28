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
var path = require('path');

import ctxm = require('../context');

//--------------------------------------------------------------------------------
// Handle Task authored in a shell script (script ends in sh: somefile.sh)
//
// 		scriptPath: abs path to script in tasks folder (infra figures that out)
///-------------------------------------------------------------------------------
export function runTask(scriptPath: string, ctx: ctxm.TaskContext, callback): void {
	// set env var for each input value
	for (var key in ctx.inputs){
		var envVarName = 'INPUT_' + key.toUpperCase();
		process.env[envVarName] = ctx.inputs[key];
	}

	console.log('running: ' + scriptPath);
	ctx.util.spawn('sh', [scriptPath], {}, callback);
}
