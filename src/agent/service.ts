// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var path = require('path') 
  , fs = require('fs')
  , si = require('svcinstall')
  , argparser = require('minimist')
  , url = require('url')
  , heartbeat = require('./heartbeat')
  , shelljs = require('shelljs');

/// <reference path="./definitions/Q.d.ts" />

import Q = require('q');
import cm = require('./common');
import cfgm = require('./configuration');

var SVC_FILE_NAME = '.service';
var _cfgPath = path.join(__dirname, '..', SVC_FILE_NAME);

// on OSX (Darwin), a launchd daemon will get installed as: com.sample.myserver
// on Linux, a start-stop-daemon will get installed as: myserver
var args = argparser(process.argv.slice(2));
var action = args['_'][0];
console.log('action: ' + action);
var showUsage = function (code) {
    console.log('usage: svc.sh install, start, stop, restart');
    console.log('\taction=install, start, stop');
    console.log('\tnote: only install needs username and password');
    process.exit(code);
};
if (!action || action === '-?') {
    showUsage(action ? 0 : 1);
}
if (!cfgm.exists()) {
    console.error('The agent must be configured before running as a service. Run the agent and configure.');
    process.exit(1);
}
// servicename: vsoagent.{accountName}.{agentName}
var cfg = cfgm.read();
var hostName = url.parse(cfg.serverUrl).hostname;
var accountName = hostName.split('.')[0];
var agentName = cfg.agentName;
var svcName = 'vsoagent.' + accountName + '.' + agentName;
console.log('serviceName: vsoagent.' + svcName);
var svcinstall = new si.SvcInstall();

/*
if (typeof svcinstall[action] !== 'function') {
    showUsage(1);
}*/

// node is known as nodejs on some *nix installs
var nodePath = shelljs.which('nodejs') || shelljs.which('node');
var getSvcCfg = function () {
    if (!shelljs.test('-f', _cfgPath)) {
        console.error('Error: not configured as a service.  use install action.');
        return null;
    }
    var svcCfg = JSON.parse(fs.readFileSync(_cfgPath).toString());
    return svcCfg;
};

var runAction = function (action, item): Q.Promise<void> {
    var defer = Q.defer<void>();

    console.log();
    console.log(action + ' ' + item);
    svcinstall[action](item, function (err) {
        
        if (err) {
            // status grep no result returns 1
            if (action == 'status' && err.code == 1) {
                console.log('none found.')
                defer.resolve(null);
                return;
            }

            defer.reject(err);
            return;
        }

        // TODO: we are need getting a graceful exit from these two actions.  investigate.  for now, cleaning up heartbeat
        if (action == 'stop' || action == 'uninstall') {
            heartbeat.stop();
        }

        console.log('Success.');
        defer.resolve(null);
    });

    return defer.promise;
}

var installSvc = function(svcName, options): Q.Promise<any> {
    var defer = Q.defer<any>();

    svcinstall.install(svcName, options, function (err, config) {
        if (err) {
            defer.reject(err);
            return;
        }

        console.log('\tname    : ' + config["name"]);
        console.log('\tlogs    : ' + config["logFolder"]);
        console.log('\tservice : ' + config["definition"]);
        console.log();
        console.log('Writing service config to ' + SVC_FILE_NAME);
        fs.writeFileSync(_cfgPath, JSON.stringify(config, null, 2), 'utf8');
        console.log('Installed Successfully');
        defer.resolve(config); 
    });  

    return defer.promise; 
}

var currCfg;
switch (action) {
    case 'install':
        cm.readBasicCreds()
        .then((creds) => {
            var username = creds.username;
            var password = creds.password;
            if (!username || !password) {
                console.log(username, password);
                showUsage(1);
            }
            var scriptPath = path.join(__dirname, 'host.js');
            var env = {};
            env[cm.envService] = '1';

            //env['VSO_AGENT_TRACE'] = '1';
            //env['HTTP_PROXY'] = 'http://localhost:8888'

            var runAsUser = process.argv[3];
            var agent = process.argv[4] === 'agent';
            var options = {
                args: [nodePath, scriptPath, '-u', username, '-p', password],
                env: env,
                workingDirectory: path.dirname(scriptPath),
                launchAgent: agent
            };

            if (runAsUser) {
                options['userName'] = runAsUser;
            }

            return options;
        })
        .then((options) => {
            return installSvc(svcName, options);
        })
        .then((config) => {
            currCfg = config;
            return runAction('start', currCfg['definition']);
        })
        .then(() => {
            return runAction('status', currCfg['name']);
        })
        .fail((err) => {
            console.error('Error:' + err.message);
            return;
        });
        break;

    case 'uninstall':
        var svcCfg = getSvcCfg();
        if (svcCfg) {
            runAction('uninstall', svcCfg['definition'])
            .fail((err) => {
                console.error(err.message);
            });
        }
        break;
    case 'stop':
        var svcCfg = getSvcCfg();
        if (svcCfg) {
            runAction('stop', svcCfg['definition'])
            .fail((err) => {
                console.error(err.message);
            });
        }
        break;

    case 'start':
        var svcCfg = getSvcCfg();
        if (svcCfg) {
            runAction('start', svcCfg['definition'])
            .then(() => {
                return runAction('status', svcCfg['name'])
            })
            .fail((err) => {
                console.error(err.message);
            });
        }
        break;

    case 'status':
        var svcCfg = getSvcCfg();
        if (svcCfg) {
            runAction('status', svcCfg['name'])
            .fail((err) => {
                console.error(err.message);                           
            });            
        }
        break;

    case 'list':
        var svcCfg = getSvcCfg();
        if (svcCfg) {
            runAction('status', '.vsoagent')
            .fail((err) => {
                console.error(err.message);
            });
        }
        break;        

    case 'restart':
        var svcCfg = getSvcCfg();
        if (svcCfg) {
            runAction('stop', svcCfg['definition'])
            .then(() => {
                return runAction('start', svcCfg['definition']);
            })
            .then(() => {
                return runAction('status', svcCfg['name']);
            })            
            .fail(function(err) {
                console.error(err.message);
            });
        }
        break;

    default:
        showUsage(1);
}
