// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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