// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var sh = require('svchost')
  , shell = require('shelljs')
  , path = require('path');

import env = require('./environment');

// agent must be configured before run as a service
if (!shell.test('-f', path.join(__dirname, '..', '.agent'))) {
    console.error('Agent must be configured.  Run vsoagent configure');
    process.exit(1);
}

var banner = function(str) {
    console.log('--------------------------------------------');
    console.log(str);
    console.log('--------------------------------------------');
}

var formatOutput = function(level, output) {
    return '[' + level + ']' + (new Date()).toTimeString() + ': ' + output;
}

var host = new sh.SvcHost();
host.on('start', function(pid, starts){
    banner('started (' + pid + ') - ' + starts + ' starts');
});

host.on('restart', function(){
    banner('restart.  ');
});     

host.on('exit', function(code, reason){
    banner('exit (' + code + ') : ' + reason);
}); 

host.on('abort', function(){
    banner('abort after restarts');
});

host.on('stdout', function(data){
    process.stdout.write(formatOutput('out', data));
});

host.on('stderr', function(data){
    process.stdout.write(formatOutput('err', data));
});

//
// Will restart indefinately.  Each restart adds 10 seconds to wait up to 5 min
//
var MAX_DELAY = 5 * 60 * 1000;
var delay = 0;

var handleRestart = function(starts, relaunch) {
    console.log(starts + ' starts');

    // add 10 seconds each restart up to MAX_DELAY
    delay = delay >= MAX_DELAY ? MAX_DELAY : delay += (10 * 1000);

    console.log('waiting to restart: ' + delay/1000 + ' seconds');
    setTimeout(function(){
            console.log('restarting')
            relaunch(true);
        },
        delay);
}

// set additional env vars for the service from a file
// then start up the service's host

env.getEnv(path.join(__dirname, '..', 'env.agent'), (err, env) => {
    if (err) {
        console.error(err);
        return;
    }

    console.log(JSON.stringify(env, null, 2));

    host.start(path.join(__dirname, 'vsoagent.js'),
                { args:process.argv.slice(2), env: env },                       
                handleRestart);     
});

