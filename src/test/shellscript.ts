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

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import util = require('./util');
import fm = require('./lib/feedback');
import wk = require('../agent/vsoworker');
import cm = require('../agent/common');

describe('ShellScript Job', function() {
	it('should run', function(done) {
		this.timeout(60000);
		var config:cm.IConfiguration = <cm.IConfiguration>{};
		config.settings = <cm.ISettings>{};
		config.settings.poolName = 'default';
		config.settings.serverUrl = 'https://cjtest.tfsbuildhost3.tfsallin.net';
		config.settings.agentName = 'test';
		config.settings.workFolder = './work'
		config.creds = {};
		config.creds.username = 'chjohn';
		config.creds.password = 'GameNight!';
		config.poolId = 1;
		// TODO fix up issues with shellscript.json
		var messageBody = require('./messages/shellscript.json');
		var workerMsg = { 
			messageType:"job",
			config: config,
			data: messageBody
		}
		util.createWork('_build/vsoxplat/agent/work');
		wk.run(workerMsg,
			function(agentUrl, taskUrl, jobInfo, ag) {
				return new fm.TestFeedbackChannel();
			},
			function() {
				done();
		});
	});
});