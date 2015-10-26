// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import dm = require('../agent/diagnostics');
import cm = require('../agent/common');
import shell = require('shelljs');
import assert = require('assert');
import fs = require('fs');
import plugin = require('../agent/plugins/release/prepare');
import ctx = require('./lib/testExecutionContext');
import jobInf = require('./lib/testJobInfo');
import releaseCommon = require('../agent/plugins/release/lib/common');

var path = require('path');

describe('Release plugin before job', () => {
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
	var currentLine = 0;
	var files: string[];

    it("Creates a hash for a teamProject and releaseDefinition", (done) => {
        var hash = plugin.createHash("StubTeamProject", "StubReleaseDefinitionName");
        assert(hash === "9cab5c7aa406b27c1c4d011e3c3eb222df7d107e90f1ce4cbf87ecfaa2b40c9e");
        done();
    });

    it("Cleans up the artifact directory", (done) => {
        for (var currentLine = 0; currentLine < config.settings.logSettings.linesPerFile; currentLine++) {
            writer.write('line ' + currentLine + '\n');
        }
        writer.end();

        files = fs.readdirSync(folder);
        fs.readdirSync(cm.getWorkerDiagPath(config));
        assert(files.length === 1, 'expected one file, found ' + files.length);
        var context = new ctx.TestExecutionContext(new jobInf.TestJobInfo({}));
        plugin.cleanUpArtifactsDirectory(context, folder, function (err) {
            if (err) {
                assert(1 === 2, 'Error while cleaning up the artifacts folder: ' + err);
            }
        });

        files = fs.readdirSync(folder);
        assert(files.length === 0, 'expected folder to be empty, found files: ' + files.length);
        done();
    });

    it("Sets the variables", (done) => {
        var context = new ctx.TestExecutionContext(new jobInf.TestJobInfo({}));
        plugin.setAndLogLocalVariables(context, folder, []);

        assert(context.variables[releaseCommon.releaseVars.agentReleaseDirectory] === folder, 'Agent release directory should be set as a variable');
        assert(context.variables[releaseCommon.releaseVars.systemArtifactsDirectory] === folder, 'System artifacts directory should be set as variable');
        assert(context.variables[cm.AutomationVariables.defaultWorkingDirectory] === folder, 'System default working directory should be set as variable');
        done();
    });

    it("plugin name should not change", (done) => {
        var pluginName = plugin.pluginName();

        assert(pluginName === "Download artifacts", "Plugin name for the before job release plugin should not change");
        done();
    })
});