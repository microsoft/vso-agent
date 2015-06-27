#!/usr/bin/env node

// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var fs = require('fs');
var cm = require('../../common');
var path = require('path');

var action = process.argv[2] || 'none';
var username = process.env['GIT_USERNAME'] || '';
var password = process.env['GIT_PASSWORD'] || '';

var trace = function(message) {
	if (process.env[cm.envTrace]) {
		// get _diag path from envvar
		fs.appendFileSync('./test2.txt', message);
	}
}

trace(new Date().toString() + ':' + action + ':' + username + ':' + password.length);

if (action && username && password && action === 'get') {
	console.log('username=' + username);
	console.log('password=' + password);	
}

