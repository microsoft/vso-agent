#!/usr/bin/env node

// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var fs = require('fs');
var cm = require('../../common');
var path = require('path');

var action = process.argv[2] || 'none';
var username = process.env['GIT_USERNAME'] || '';
var password = process.env['GIT_PASSWORD'] || '';

var tracePath = path.join(process.env[cm.envWorkerDiagPath] || __dirname, 'git_' + new Date().toISOString().replace(':', '-') + '.log');
var trace = function(message) {
	if (process.env[cm.envCredTrace]) {
		fs.appendFileSync(tracePath, message);
	}
}

trace(new Date().toString() + ':' + action + ':' + username + ':' + password);

if (action && username && password && action === 'get') {
	console.log('username=' + username);
	console.log('password=' + password);	
}
