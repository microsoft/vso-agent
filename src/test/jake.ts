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

import gm = require('./lib/gitrepo');
import assert = require('assert');
import util = require('./util');
import fm = require('./lib/feedback');
import wk = require('../agent/vsoworker');
import cm = require('../agent/common');

describe('Jake Job', function() {
	var repo: gm.GitRepo;

	beforeEach(function(done) {
		util.createTestProjectRepo('jake', function(err, createdRepo) {
			if (!err) {
				repo = createdRepo;
			} else {
				assert.fail('Failed to create repo: ' + err);
			}
			done();
		});
	});

	afterEach(function() {
		if (repo) {
			util.cleanup(repo);
		}
	});

	it('should run', function(done) {
		this.timeout(60000);
		var config: cm.IConfiguration = util.createTestConfig();
		// TODO fix up issues with shellscript.json
		var messageBody = require('./messages/jake.json');
		messageBody.environment.endpoints[0].url = repo.repo;
		var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
		var workerMsg = { 
			messageType:"job",
			config: config,
			data: messageBody
		}
		wk.run(workerMsg,
			function(agentUrl, taskUrl, jobInfo, ag) {
				return feedbackChannel;
			},
			function() {
				done();
		});
	});
});