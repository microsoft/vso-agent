// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import shell = require('shelljs');
import path = require('path');
import fs = require('fs');
var tl;

describe('Test vso-task-lib', function() {

	before(function(done) {
		try
		{
			tl = require('../vso-task-lib');
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
});
