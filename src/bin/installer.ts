// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var shell = require('shelljs');
var path = require('path');

var installDir = path.join(__dirname, '..');
var agentDir = path.join(installDir, 'agent');
var targetDir = process.cwd();

console.log('Installing agent to ' + targetDir);

console.log('Copying: ', agentDir, targetDir);
shell.cp('-R', agentDir, targetDir);

var modsDir = path.join(installDir, 'node_modules');
var targetAgent = path.join(targetDir, 'agent');
console.log('Copying: ', modsDir, targetDir);
shell.cp('-R', modsDir, targetDir);
shell.cp(path.join(installDir, 'package.json'), targetDir);

console.log('making scripts executable')
shell.chmod('u+x', path.join(targetAgent, 'svc.sh'));
shell.chmod('u+x', path.join(targetAgent, 'plugins/build/lib/askpass.js'));

console.log('Done.');