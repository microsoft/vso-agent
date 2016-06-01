// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import path = require('path');
import fm = require('./lib/feedback');
import cce = require('../agent/codecoverageenabler');
import ccec = require('../agent/commands/codecoverage.enable');
import cm = require('../agent/common');
import ifm = require('../agent/interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import tc = require('./lib/testcommand');
import ctxm = require('../agent/context');
import tec = require('./lib/testExecutionContext');
import fs = require('fs');

var shell = require('shelljs');
var jobInf = require('./lib/testJobInfo');

describe('CodeCoverageEnablerTests', function() {

    var invalidBuildFile = path.resolve(__dirname, './javabuildfiles/test.gradle');
    var gradleFile = path.resolve(__dirname, './javabuildfiles/build.gradle');
    var gradleJacocoSingleModuleFile = path.resolve(__dirname, './javabuildfiles/build_jacoco_cc.gradle');
    var summaryFile = path.resolve(__dirname, './javabuildfiles/summary.xml');
    var reportDir = path.resolve(__dirname);
    var testExecutionContext;
    var includeFilter = "+:com.*.*,+:app.me*.*";
    var excludeFilter = "-:me.*.*,-:a.b.*,-:my.com.Test";
    var jacocoIncludeFilter = "'com/*/*/**','app/me*/*/**'";
    var jacocoExcludeFilter = "'me/*/*/**','a/b/*/**','my/com/Test.class'"
    var coberturaIncludeFilter = "'.*com.*..*','.*app.me*..*'"
    var coberturaExcludeFilter = "'.*me.*..*','.*a.b..*','.*my.com.Test'"

    it('codecoverage.enable : Verify code coverage tool is not valid', function(done) {
        this.timeout(2000);
        var properties: { [name: string]: string } = { "codecoveragetool": "", "summaryfile": gradleFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().fail(
            function(err) {
                var expectedMessage = "Error: No code coverage tool is provided.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.enable : Verify build tool is not valid', function(done) {
        this.timeout(2000);
        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().fail(
            function(err) {
                var expectedMessage = "Error: No build tool is provided.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.enable : Verify summary file is not valid', function(done) {
        this.timeout(2000);
        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gradle" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().fail(
            function(err) {
                var expectedMessage = "Error: No code coverage summary file is provided.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.enable : Verify build file is not valid', function(done) {
        this.timeout(2000);
        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gradle", "summaryfile": summaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().fail(
            function(err) {
                var expectedMessage = "Error: Build file is not provided.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.enable : Verify Report directory is not valid', function(done) {
        this.timeout(2000);
        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": invalidBuildFile, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().fail(
            function(err) {
                var expectedMessage = "Error: Report Directory is not provided.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.enable : Verify build file exists or not', function(done) {
        this.timeout(2000);
        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": invalidBuildFile, "reportdir": reportDir, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().fail(
            function(err) {
                var expectedMessage = "Error: Build file '" + invalidBuildFile + "' doesnot exist or it is not a valid file.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.enable : Throw error in case of non-supported code coverage/build tool', function(done) {
        this.timeout(2000);
        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gulp", "summaryfile": summaryFile, "buildfile": gradleJacocoSingleModuleFile, "reportdir": reportDir, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().fail(
            function(err) {
                var expectedMessage = "Error: Code coverage tool 'jacoco' and build tool 'gulp' is not supported.";
                assert(err == expectedMessage);
                done();
            });
    })

    // Jacoco-Gralde specific test cases - START
    it('codecoverage.enable : Verify code coverage enabled for Jacoco Gradle Single Module build', function(done) {
        this.timeout(2000);
        var tempFile = path.join(shell.tempdir(), "build.gradle");
        fs.unlinkSync(tempFile);
        fs.writeFileSync(tempFile, fs.readFileSync(gradleFile));

        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": tempFile, "reportdir": reportDir, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().then(function(res) {
            assert(res);
            fs.readFile(tempFile, 'utf-8', function(err, data) {
                assert(data.indexOf("def jacocoExcludes = []") != -1);
                assert(data.indexOf("def jacocoIncludes = []") != -1);
                assert(data.indexOf('finalizedBy jacocoTestReport') != -1);
                assert(data.indexOf('build/classes/main/') != -1);
                done();
            });
        }).fail(function(err) {
            testExecutionContext.info("Error: " + err);
        });
    })

    it('codecoverage.enable : Verify code coverage enabled for Jacoco Gradle Multi Module build', function(done) {
        this.timeout(2000);
        var tempFile = path.join(shell.tempdir(), "build.gradle");
        fs.unlinkSync(tempFile);
        fs.writeFileSync(tempFile, fs.readFileSync(gradleFile));

        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": tempFile, "ismultimodule": "true", "reportdir": reportDir, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().then(function(res) {
            assert(res);
            fs.readFile(tempFile, 'utf-8', function(err, data) {
                assert(data.indexOf("def jacocoExcludes = []") != -1);
                assert(data.indexOf("def jacocoIncludes = []") != -1);
                assert(data.indexOf('task jacocoRootReport') != -1);
                assert(data.indexOf('build/classes/main/') != -1);
                done();
            });
        }).fail(function(err) {
            testExecutionContext.info("Error: " + err);
        });
    })

    it('codecoverage.enable : Verify code coverage enabled for Jacoco Gradle Single Module build with filters', function(done) {
        this.timeout(2000);
        var tempFile = path.join(shell.tempdir(), "build.gradle");
        fs.unlinkSync(tempFile);
        fs.writeFileSync(tempFile, fs.readFileSync(gradleFile));

        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": tempFile, "reportdir": reportDir, "classfilter": includeFilter + "," + excludeFilter, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().then(function(res) {
            assert(res);
            fs.readFile(tempFile, 'utf-8', function(err, data) {
                assert(data.indexOf(jacocoExcludeFilter) != -1);
                assert(data.indexOf(jacocoIncludeFilter) != -1);
                assert(data.indexOf('finalizedBy jacocoTestReport') != -1);
                assert(data.indexOf('build/classes/main/') != -1);
                done();
            });
        }).fail(function(err) {
            testExecutionContext.info("Error: " + err);
        });
    })

    it('codecoverage.enable : Verify code coverage enabled for Jacoco Gradle Multi Module with filters', function(done) {
        this.timeout(2000);
        var tempFile = path.join(shell.tempdir(), "build.gradle");
        fs.unlinkSync(tempFile);
        fs.writeFileSync(tempFile, fs.readFileSync(gradleFile));

        var properties: { [name: string]: string } = { "codecoveragetool": "jacoco", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": tempFile, "ismultimodule": "true", "reportdir": reportDir, "classfilter": includeFilter + "," + excludeFilter, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().then(function(res) {
            assert(res);
            fs.readFile(tempFile, 'utf-8', function(err, data) {
                assert(data.indexOf(jacocoExcludeFilter) != -1);
                assert(data.indexOf(jacocoIncludeFilter) != -1);
                assert(data.indexOf('task jacocoRootReport') != -1);
                assert(data.indexOf('build/classes/main/') != -1);
                done();
            });
        }).fail(function(err) {
            testExecutionContext.info("Error: " + err);
        });
    })
    // Jacoco-Gralde specific test cases - END

    // Cobertura-Gralde specific test cases - START
    it('codecoverage.enable : Verify code coverage enabled for Cobertura Gradle Single Module build', function(done) {
        this.timeout(2000);
        var tempFile = path.join(shell.tempdir(), "build.gradle");
        fs.unlinkSync(tempFile);
        fs.writeFileSync(tempFile, fs.readFileSync(gradleFile));

        var properties: { [name: string]: string } = { "codecoveragetool": "cobertura", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": tempFile, "reportdir": reportDir, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().then(function(res) {
            assert(res);
            fs.readFile(tempFile, 'utf-8', function(err, data) {
                assert(data.indexOf("cobertura.coverageIncludes = []") != -1);
                assert(data.indexOf("cobertura.coverageExcludes = []") != -1);
                assert(data.indexOf('coverageMergeDatafiles') == -1);
                assert(data.indexOf('build/classes/main/') != -1);
                done();
            });
        }).fail(function(err) {
            testExecutionContext.info("Error: " + err);
        });
    })

    it('codecoverage.enable : Verify code coverage enabled for Cobertura Gradle Multi Module build', function(done) {
        this.timeout(2000);
        var tempFile = path.join(shell.tempdir(), "build.gradle");
        fs.unlinkSync(tempFile);
        fs.writeFileSync(tempFile, fs.readFileSync(gradleFile));

        var properties: { [name: string]: string } = { "codecoveragetool": "cobertura", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": tempFile, "ismultimodule": "true", "reportdir": reportDir, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().then(function(res) {
            assert(res);
            fs.readFile(tempFile, 'utf-8', function(err, data) {
                assert(data.indexOf("cobertura.coverageIncludes = []") != -1);
                assert(data.indexOf("cobertura.coverageExcludes = []") != -1);
                assert(data.indexOf('coverageMergeDatafiles') != -1);
                assert(data.indexOf('build/classes/main/') != -1);
                done();
            });
        }).fail(function(err) {
            testExecutionContext.info("Error: " + err);
        });
    })

    it('codecoverage.enable : Verify code coverage enabled for Cobertura Gradle Single Module build with filters', function(done) {
        this.timeout(2000);
        var tempFile = path.join(shell.tempdir(), "build.gradle");
        fs.unlinkSync(tempFile);
        fs.writeFileSync(tempFile, fs.readFileSync(gradleFile));

        var properties: { [name: string]: string } = { "codecoveragetool": "cobertura", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": tempFile, "reportdir": reportDir, "classfilter": includeFilter + "," + excludeFilter, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().then(function(res) {
            assert(res);
            fs.readFile(tempFile, 'utf-8', function(err, data) {
                assert(data.indexOf(coberturaExcludeFilter) != -1);
                assert(data.indexOf(coberturaIncludeFilter) != -1);
                assert(data.indexOf('coverageMergeDatafiles') == -1);
                assert(data.indexOf('build/classes/main/') != -1);
                done();
            });
        }).fail(function(err) {
            testExecutionContext.info("Error: " + err);
        });
    })

    it('codecoverage.enable : Verify code coverage enabled for Cobertura Gradle Multi Module with filters', function(done) {
        this.timeout(2000);
        var tempFile = path.join(shell.tempdir(), "build.gradle");
        fs.unlinkSync(tempFile);
        fs.writeFileSync(tempFile, fs.readFileSync(gradleFile));

        var properties: { [name: string]: string } = { "codecoveragetool": "cobertura", "buildtool": "gradle", "summaryfile": summaryFile, "buildfile": tempFile, "ismultimodule": "true", "reportdir": reportDir, "classfilter": includeFilter + "," + excludeFilter, "classfiledirs": "build/classes/main/" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var ccEnableCommand = new ccec.CodeCoverageEnableCommand(testExecutionContext, command);
        ccEnableCommand.runCommandAsync().then(function(res) {
            assert(res);
            fs.readFile(tempFile, 'utf-8', function(err, data) {
                assert(data.indexOf(coberturaExcludeFilter) != -1);
                assert(data.indexOf(coberturaIncludeFilter) != -1);
                assert(data.indexOf('coverageMergeDatafiles') != -1);
                assert(data.indexOf('build/classes/main/') != -1);
                done();
            });
        }).fail(function(err) {
            testExecutionContext.info("Error: " + err);
        });
    })
    // Cobertura-Gralde specific test cases - END
});	
