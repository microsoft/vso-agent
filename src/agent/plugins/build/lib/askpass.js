#!/usr/bin/env node

// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
        var uname = process.env['GIT_USERNAME'];
        if (uname) {
            process.stdout.write(uname);
        }
    }

    if (prompt.startsWith('Password')) {
        var pwd = process.env['GIT_PASSWORD'];
        if (pwd) {
            process.stdout.write(pwd);
        }
    }   
}


