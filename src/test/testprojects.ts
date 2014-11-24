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

describe('Test Projects', function() {
	var repo: gm.GitRepo;

	before(function(done) {
		util.createTasksDirectory('../agent');
		util.createTestProjectRepo(function(err, createdRepo) {
			if (!err) {
				repo = createdRepo;
			} else {
				assert.fail('Failed to create repo: ' + err);
			}
			done();
		});
	});

	after(function() {
		if (repo) {
			util.cleanup(repo);
		}
		util.deleteTasksDirectory('../agent');
	});

	describe('XCode', util.hasCapability('xcode') ? function() {
		it('runs', function(done) {
			this.timeout(30000);
			var workerMsg = util.createTestMessage('xcode', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(feedbackChannel.jobsCompletedSuccessfully(), feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support xcode');});

	describe('Jake', util.hasCapability('jake') ? function() {
		it('runs', function(done) {
			this.timeout(10000);
			var workerMsg = util.createTestMessage('jake', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(feedbackChannel.jobsCompletedSuccessfully(), feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support jake');});

	describe('Cmake', util.hasCapability('cmake') ? function() {
		it('runs', function(done) {
			this.timeout(10000);
			var workerMsg = util.createTestMessage('cmake', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(feedbackChannel.jobsCompletedSuccessfully(), feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support jake');});

	describe('Shellscript', util.hasCapability('sh') ? function() {
		it('runs', function(done) {
			this.timeout(10000);
			var workerMsg = util.createTestMessage('shellscript', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(feedbackChannel.jobsCompletedSuccessfully(), feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support shellscript');});
});