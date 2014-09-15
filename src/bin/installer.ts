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

var agentDir = path.join(__dirname, '..', 'agent');
var targetDir = process.cwd();

console.log('Installing agent to ' + targetDir);

console.log('Copying: ', agentDir, targetDir);
shell.cp('-R', agentDir, targetDir);

var modsDir = path.join(__dirname, '..', 'node_modules');
var targetMods = path.join(targetDir, 'agent');
console.log('Copying: ', modsDir, targetMods);
shell.cp('-R', modsDir, targetMods);

console.log('Done.');