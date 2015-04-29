// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import shell = require('shelljs');
import path = require('path');
import fs = require('fs');
import util = require('util');
import stream = require('stream');
import fm = require('./lib/feedback');
import trp = require('../agent/testrunpublisher');
import trr = require('../agent/testresultreader');
import ifm  =require('../agent/api/interfaces');

var tl;

var NullStream = function() {
	stream.Writable.call(this);
	this._write = function(data, encoding, next) {
		next();
	}
}
util.inherits(NullStream, stream.Writable);

var _nullTestStream = new NullStream();

describe('Test vso-task-lib', function() {

	before(function(done) {
		try
		{
			tl = require('../vso-task-lib');
			tl.setStdStream(_nullTestStream);
			tl.setErrStream(_nullTestStream);
		}
		catch (err) {
			assert.fail('Failed to load task lib: ' + err.message);
		}
		done();
	});

	after(function() {

	});

	describe('Dir Operations', function() {
		it('mkdirs', function(done) {
			this.timeout(1000);

			var testFolder = 'testDir';
			var start = __dirname;
			var testPath = path.join(__dirname, testFolder);
			tl.cd(start);
			assert(process.cwd() == start, 'starting in right directory');
			tl.mkdirP(testPath);
			assert(shell.test('-d', testPath), 'directory created');
			tl.pushd(testFolder);
			assert(process.cwd() == testPath, 'cwd is created directory');
			tl.popd(testFolder);

			done();
		});
	});

	describe('TaskCommands', function() {
		it('constructs', function(done) {
			this.timeout(1000);

			assert(tl.TaskCommand, 'TaskCommand should be available');
			var tc = new tl.TaskCommand('some.cmd', {foo: 'bar'}, 'a message');
			assert(tc, 'TaskCommand constructor works');

			done();
		})
		it('toStrings', function(done) {
			this.timeout(1000);

			var tc = new tl.TaskCommand('some.cmd', {foo: 'bar'}, 'a message');
			assert(tc, 'TaskCommand constructor works');
			var cmdStr = tc.toString();
			assert(cmdStr === '##vso[some.cmd foo=bar;]a message');
			done();
		})
		it('handles null properties', function(done) {
			this.timeout(1000);

			var tc = new tl.TaskCommand('some.cmd', null, 'a message');
			assert(tc.toString() === '##vso[some.cmd]a message');
			done();
		})
		it('handles empty properties', function(done) {
			this.timeout(1000);

			var tc = new tl.TaskCommand('some.cmd', {}, 'a message');
			console.log(tc.toString());
			assert(tc.toString() === '##vso[some.cmd]a message');
			done();
		})
		it('results.publish : basic', function(done) {
			this.timeout(2000);

            var runContext: trp.TestRunContext = {
                requestedFor: "userx",
                buildId: "21",
                platform: "",
                config: ""
            };
            var reader = new trr.JUnitResultReader();
            var resultsFile = path.resolve(__dirname, './testresults/junitresults1.xml');
			var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			var testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, reader);

			testRunPublisher.publishTestRun(resultsFile).then(function (createdTestRun) {
				assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
                done();
            },
            function (err) {
            	assert(false, 'ResultPublish Task Failed! Details : '  + err.message);
            });
		})		
		it('results.publish : error handling/propagation', function(done) {
			this.timeout(2000);

            var runContext: trp.TestRunContext = {
                requestedFor: "userx",
                buildId: "21",
                platform: "",
                config: ""
            };
            var reader = new trr.JUnitResultReader();
            var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
			var testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, reader);
			
			var testRun: ifm.TestRun = <ifm.TestRun> {
	            name: "foobar",
	        	id: -1
	        };

	        // error handling/propagation from start test run 
			testRunPublisher.startTestRun(testRun, resultsFile).then(function (createdTestRun) {
				assert(false, 'ResultPublish Task did not fail as expected');
            },
            function (err) {
            	assert(err.message == "Too bad - createTestRun failed", 'ResultPublish Task error message does not match expected - ' + err.message);
            });

	        // error handling/propagation from end test run 
			testRunPublisher.endTestRun(testRun.id).then(function (createdTestRun) {
				assert(false, 'ResultPublish Task did not fail as expected');
            },
            function (err) {
            	assert(err.message == "Too bad - endTestRun failed", 'ResultPublish Task error message does not match expected - ' + err.message);
            });

            // error handling/propagation from parsing failures of junit/nunit files
			var resultsFile = path.resolve(__dirname, './testresults/junit_bad.xml');
			testRunPublisher.publishTestRun(resultsFile).then(function (createdTestRun) {
				assert(!feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
            },
            function (err) {
            	assert(err.message == "Unmatched closing tag: XYZXYZuite\nLine: 13\nColumn: 16\nChar: >",
            		'ResultPublish Task Failed as expected! Details : '  + err.message);
            	done();
            });
		})		
	});	

	describe('ToolRunner', function() {
		it('Execs', function(done) {
			this.timeout(1000);

			tl.pushd(__dirname);

			var ls = new tl.ToolRunner(tl.which('ls', true));
			ls.arg('-l');
			ls.arg('-a');

			ls.exec({outStream:_nullTestStream, errStream:_nullTestStream})
				.then(function(code) {
					assert(code === 0, 'return code of ls should be 0');
				})
				.fail(function(err) {
					assert.fail('ls failed to run: ' + err.message);
				})
				.fin(function() {
					tl.popd();
					done();
				})
		})
		it ('Fails on return code 1', function(done) {
			this.timeout(1000);

			var failed = false;

			var ls = new tl.ToolRunner(tl.which('ls', true));
			ls.arg('-j');

			ls.exec({outStream:_nullTestStream, errStream:_nullTestStream})
				.then(function(code) {
					assert(code === 1, 'return code of ls -j should be 1');
				})
				.fail(function(err) {
					failed = true;
				})
				.fin(function() {
					if (!failed) {
						done(new Error('ls should have failed'));
						return;
					}

					done();
				})
		})
		it ('Succeeds on stderr by default', function(done) {
			this.timeout(1000);

			var scriptPath = path.join(__dirname, 'scripts', 'stderrOutput.js');
			var ls = new tl.ToolRunner(tl.which('node', true));
			ls.arg(scriptPath);

			ls.exec({outStream:_nullTestStream, errStream:_nullTestStream})
				.then(function(code) {
					assert(code === 0, 'should have succeeded on stderr');
				})
				.fail(function(err) {
					done(new Error('did not succeed on stderr'))
				})
				.fin(function() {
					done();
				})
		})
		it ('Fails on stderr if specified', function(done) {
			this.timeout(1000);

			var failed = false;

			var scriptPath = path.join(__dirname, 'scripts', 'stderrOutput.js');
			var ls = new tl.ToolRunner(tl.which('node', true));
			ls.arg(scriptPath);

			ls.exec({failOnStdErr: true, outStream:_nullTestStream, errStream:_nullTestStream})
				.then(function(code) {
					assert(code === 0, 'should have succeeded on stderr');
				})
				.fail(function(err) {
					failed = true;
				})
				.fin(function() {
					if (!failed) {
						done(new Error('should have failed on stderr'));
						return;
					}

					done();
				})
		})
	});	

});
