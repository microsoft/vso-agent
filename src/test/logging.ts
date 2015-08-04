// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import dm = require('../agent/diagnostics');
import cm = require('../agent/common');
import shell = require('shelljs');
import assert = require('assert');
import fs = require('fs');

var path = require('path');

describe('Rolling diagnostic file writer', () => {
	before((done) => {
		done();
	});
	
	describe("something", () => {
		it("runs", (done) => {
			var config = <cm.IConfiguration>{
				settings: <cm.ISettings>{
					workFolder: './_work',
					logSettings: {
						linesPerFile: 10,
						maxFiles: 3
					}
				}
			};
			
			var folder = path.join(cm.getWorkerDiagPath(config), 'rollingdiagnosticfilewriter');
			console.log('folder = ' + folder);
			
			// delete the folder. the writer should recreate it
			shell.rm('-rf', folder);
			
			var writer = new dm.RollingDiagnosticFileWriter(cm.DiagnosticLevel.Verbose, folder, 'test', config.settings.logSettings);
			
			// write some lines
			var currentLine = 0;
			for (var currentLine = 0; currentLine < config.settings.logSettings.linesPerFile; currentLine++) {
				writer.write('line ' + currentLine + '\n');
			}
			
			var files = fs.readdirSync(folder);
			assert(files.length === 1, 'expected one log file, found ' + files.length);
			
			// write another line. this should create another file
			writer.write('line ' + currentLine++ + '\n');
			
			files = fs.readdirSync(folder);
			//assert(files.length === 2, 'expected two log files, found ' + files.length);
			
			// write enough lines to roll over
			while (currentLine < config.settings.logSettings.linesPerFile * config.settings.logSettings.maxFiles + 1) {
				writer.write('line ' + currentLine++ + '\n');
			}
			
			files = fs.readdirSync(folder);
			assert(files.length === config.settings.logSettings.maxFiles, 'expected ' + config.settings.logSettings.maxFiles + ' log files, found ' + files.length);
			
			done();
		});
	});
	
	after(() => {
	});
});