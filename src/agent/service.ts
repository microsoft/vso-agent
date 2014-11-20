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

var path = require('path') 
  , si = require('svcinstall')
  , argparser = require('minimist')
  , url = require('url')
  , shelljs = require('shelljs');

import cm = require('./common');
import cfgm = require('./configuration');

// on OSX (Darwin), a launchd daemon will get installed as: com.sample.myserver
// on Linux, a start-stop-daemon will get installed as: myserver

var args = argparser(process.argv.slice(2));
var action = args['_'][0];

var showUsage = function(code) {
    console.log('usage: sudo node service [action] [-u <altusername>] [-p <altpassword>]');
    console.log('\taction=install, start, stop');
    console.log('\tnote: only install needs username and password');
	process.exit(code);	
}

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

var svcName = accountName + '.' + agentName;
console.log('serviceName: vsoagent.' + svcName);

var svcinstall = new si.SvcInstall(svcName, 'vsoagent');

if (typeof svcinstall[action] !== 'function') {
	showUsage(1);
}

// node is known as nodejs on some *nix installs
var nodePath = shelljs.which('nodejs') || shelljs.which('node');

switch (action) {
	case 'install':        	
		cm.getCreds((err, creds) => {
			var username = creds['username'];
			var password = creds['password'];

			if (!username || !password) {
				console.log(username, password);
				showUsage(1);
			}

			if (err) {
				console.error('Error:', err.message);
				return;
			}

			var scriptPath = path.join(__dirname, 'host.js');
			var env = {};
			env[cm.envService] = '1';
			var options = { 
					args: [nodePath, scriptPath, '-u', username, '-p', password],
					env: env,
					workingDirectory: path.dirname(scriptPath)
				};

			svcinstall.install(options, function(err){
				if (err) {
					console.error('Error:', err.message);
					return;
				}

				console.log('Installed Successfully');

				svcinstall.start(function(err) {
					if (err) {
						console.error('Failed to start: ', err);
					}

					console.log('Started Successfully');
				});
			});
		});
		break;
	default:
		svcinstall[action](function(err) {
			if (err) {
				console.error('Error: ', err);
				return;
			}

			console.log(action + ': Success.');			
		});
}

