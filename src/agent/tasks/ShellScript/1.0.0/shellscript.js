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

exports.execute = function(ctx, callback) {
	var _buffer;

	var workingDir = path.resolve(ctx.inputs.cwd);
	ctx.info('workingDir: ' +  workingDir);
	cd(workingDir);

	// shell script runner
	
	ctx.util.spawn('sh', [ctx.inputs.scriptName], { cwd: workingDir }, callback);
}

// TODO: (bryanmac) system needs to chmod on the script? is that configurable?
