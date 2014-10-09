#!/usr/bin/env node

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

var fs = require('fs');
var path = require('path');

String.prototype.startsWith = function (str) {
    return this.slice(0, str.length) == str;
}

// git clone <url> -c core.askpass="...path.../askpass.js"
// 
// arg[2]: Password for 'https://username@account.visualstudio.com':
// if no username in url, might be
// arg[2]: Username for 'https://account.visualstudio.com':
//

var prompt = process.argv[2];

if (prompt) {
	if (prompt.startsWith('Username')) {
		var uname = process.env['altusername'];
		if (uname) {
			process.stdout.write(uname);
		}
	}

	if (prompt.startsWith('Password')) {
		var pwd = process.env['altpassword'];
		if (pwd) {
			process.stdout.write(pwd);
		}
	}	
}


