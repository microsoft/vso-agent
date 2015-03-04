// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import gm = require('./lib/gitrepo');
import assert = require('assert');
import util = require('./util');
import fm = require('./lib/feedback');
import wk = require('../agent/vsoworker');
import cm = require('../agent/common');

describe('Test Agent + Tasks', function() {
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
			this.timeout(60000);
			var workerMsg = util.createTestMessage('xcode', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(feedbackChannel.jobsCompletedSuccessfully(), 'XCode Build Failed! Details:' + feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support xcode');});

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
					assert(feedbackChannel.jobsCompletedSuccessfully(), 'CMake Build Failed! Details:' + feedbackChannel.getRecordsString());
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
					assert(feedbackChannel.jobsCompletedSuccessfully(), 'Shellscript Build Failed! Details:' + feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support shellscript');});

	describe('Gradle', util.hasCapability('java') ? function() {
		it('runs', function(done) {
			// Gradle is slow, and it may need to bootstrap the runtime, set timeout to 30 secs
			this.timeout(120 * 1000);
			var workerMsg = util.createTestMessage('gradle', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(feedbackChannel.jobsCompletedSuccessfully(), 'Gradle Build Failed! Details:' + feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support java to run gradle wrapper script');});

    describe('Maven', util.hasCapability('maven') ? function() {
		it('runs', function(done) {
			// Maven is slow, and it may need to download dependencies, set timeout to 30 secs
			this.timeout(30 * 1000);
			var workerMsg = util.createTestMessage('maven', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(feedbackChannel.jobsCompletedSuccessfully(), 'Maven Build Failed! Details:' + feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support Maven');});

    describe('ANT', util.hasCapability('ant') ? function() {
		it('runs', function(done) {
			this.timeout(10000);
			var workerMsg = util.createTestMessage('ant', repo.repo);
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			wk.run(workerMsg, false,
				function(agentUrl, taskUrl, jobInfo, ag) {
					return feedbackChannel;
				},
				function() {
					assert(feedbackChannel.jobsCompletedSuccessfully(), 'ANT Build Failed! Details:' + feedbackChannel.getRecordsString());
					done();
			});
		});
	} : function() { it ('current system does not support Ant');});
});
