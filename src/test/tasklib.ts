// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import shell = require('shelljs');
import path = require('path');
import fs = require('fs');
import util = require('util');
import stream = require('stream');
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
