// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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

		it('fails on Exception', function(done) {
			var workerMsg = util.createTestMessage('jakefailure', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(!feedbackChannel.jobsCompletedSuccessfully(), feedbackChannel.getRecordsString());
					assert(workerMsg['data'].tasks[0].instanceId, feedbackChannel.getRecordsString());
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

	describe('Gradle', util.hasCapability('java') ? function() {
		it('runs', function(done) {
			// Gradle is slow, and it may need to bootstrap the runtime, set timeout to 30 secs
			this.timeout(30 * 1000);
			var workerMsg = util.createTestMessage('gradle', repo.repo);
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
	} : function() { it ('current system does not support java to run gradle wrapper script');});
});
