// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import path = require('path');
import fm = require('./lib/feedback');
import tec = require('./lib/testExecutionContext');
import ccp = require('../agent/codecoveragepublisher');
import cpc = require('../agent/commands/codecoverage.publish')
import csr = require('../agent/codecoveragesummaryreader');
import cm = require('../agent/common');
import ifm = require('../agent/interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import tc = require('./lib/testcommand');
import ctxm = require('../agent/context');

var shell = require('shelljs');
var jobInf = require('./lib/testJobInfo');

describe('CodeCoveragePublisherTests', function() {

    var jacocoSummaryFile = path.resolve(__dirname, './codecoveragefiles/jacoco.xml');
    var coberturaSummaryFile = path.resolve(__dirname, './codecoveragefiles/cobertura.xml');
    var invalidJacocoSummaryFile = path.resolve(__dirname, './codecoveragefiles/invalidjacoco.xml');
    var invalidCoberturaSummaryFile = path.resolve(__dirname, './codecoveragefiles/invalidcobertura.xml');
    var emptyJacocoSummaryFile = path.resolve(__dirname, './codecoveragefiles/emptyjacoco.xml');
    var emptyCoberturaSummaryFile = path.resolve(__dirname, './codecoveragefiles/emptycobertura.xml');
    var reportDirectory = path.join(shell.tempdir(), "report");
    shell.mkdir('-p', reportDirectory);
    shell.cp('-r', path.resolve(__dirname, './codecoveragefiles'), reportDirectory);
    var testExecutionContext;

    it('codecoverage.publish : publish summary fails when code coverage tool is invalid', function(done) {
        this.timeout(2000);
        var summaryFile = "./SummaryFile";
        var properties: { [name: string]: string } = { "codecoveragetool": "invalid", "summaryfile": jacocoSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                var expectedMessage = "Error: Code coverage tool 'invalid' is not supported.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.publish : publish summary fails when code coverage tool is not provided', function(done) {
        this.timeout(2000);
        var summaryFile = "./SummaryFile";
        var properties: { [name: string]: string } = { "summaryfile": jacocoSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                var expectedMessage = "Error: No code coverage tool is provided.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.publish : publish summary fails when summary xml is not provided', function(done) {
        this.timeout(2000);
        var summaryFile = "./SummaryFile";
        var properties: { [name: string]: string } = { "codecoveragetool": "JaCoCo" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                var expectedMessage = "Error: No code coverage summary file is provided.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.publish : publish summary fails when summary xml does not exist', function(done) {
        this.timeout(2000);
        var summaryFile = "./SummaryFile";
        var properties: { [name: string]: string } = { "summaryfile": summaryFile, "codecoveragetool": "JaCoCo" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                var expectedMessage = "Error: Code coverage summary file '" + summaryFile + "' doesnot exist.";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.publish : publish jacoco summary successfully', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": jacocoSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var jacocoSummaryReader = new csr.JacocoSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, jacocoSummaryReader);
        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(result);
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
            });
    })

    it('codecoverage.publish : publish summary fails when publish api fails', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": jacocoSummaryFile, "codecoveragetool": "JaCoCo" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var jacocoSummaryReader = new csr.JacocoSummaryReader(command);
        var jobInfo = new jobInf.TestJobInfo({});
        jobInfo.variables = { "build.buildId": "-1" };
        testExecutionContext = new tec.TestExecutionContext(jobInfo);

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                assert(err == "Error in the data provided");
                done();
            });
    })

    it('codecoverage.publish : publish cobertura summary successfully', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": coberturaSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, coberturaSummaryReader);

        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(result);
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
            });
    })

    it('codecoverage.publish : publish jacoco summary fails when summary xml is invalid', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": invalidJacocoSummaryFile, "codecoveragetool": "JaCoCo" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var jacocoSummaryReader = new csr.JacocoSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                var expectedMessage = "Error: Unexpected close tag" + "\n" + "Line: 11" + "\n" + "Column: 15" + "\n" + "Char: >";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.publish : publish cobertura summary fails when summary xml is invalid', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": invalidCoberturaSummaryFile, "codecoveragetool": "cobertura" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                var expectedMessage = "Error: Unexpected close tag" + "\n" + "Line: 108" + "\n" + "Column: 13" + "\n" + "Char: >";
                assert(err == expectedMessage);
                done();
            });
    })

    it('codecoverage.publish : publish jacoco summary when there is no code coverage data', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": emptyJacocoSummaryFile, "codecoveragetool": "JaCoCo" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var jacocoSummaryReader = new csr.JacocoSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(!result);
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
            });
    })

    it('codecoverage.publish : publish cobertura summary when there is no code coverage data', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": emptyCoberturaSummaryFile, "codecoveragetool": "cobertura" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(!result);
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
            });
    })

    it('codecoverage.publish : read cobertura code coverage summary', function(done) {
        this.timeout(2000);

        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        coberturaSummaryReader.getCodeCoverageSummary(coberturaSummaryFile).then(function(result) {
            assert(result && result.coverageStats && result.coverageStats.length > 0);
            assert(result.coverageStats.length == 2);
            for (var i = 0; i < result.coverageStats.length; i++) {
                switch (result.coverageStats[i].label) {
                    case "Lines":
                        assert(result.coverageStats[i].covered == 11);
                        assert(result.coverageStats[i].total == 22);
                        assert(result.coverageStats[i].position == 4);
                        break;
                    case "Branches":
                        assert(result.coverageStats[i].covered == 2.4);
                        assert(result.coverageStats[i].total == 8.8);
                        assert(result.coverageStats[i].position == 6);
                        break;
                    default: assert(false, "Unexpected code coverage stat . label : " + result.coverageStats[i].label)
                }
            }
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
            });
    })

    it('codecoverage.publish : read jacoco code coverage summary', function(done) {
        this.timeout(2000);

        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        var coberturaSummaryReader = new csr.JacocoSummaryReader(command);
        coberturaSummaryReader.getCodeCoverageSummary(jacocoSummaryFile).then(function(result) {
            assert(result && result.coverageStats && result.coverageStats.length > 0);
            assert(result.coverageStats.length == 5);
            for (var i = 0; i < result.coverageStats.length; i++) {
                switch (result.coverageStats[i].label) {
                    case "INSTRUCTION":
                        assert(result.coverageStats[i].covered == 8);
                        assert(result.coverageStats[i].total == 22);
                        assert(result.coverageStats[i].position == 5);
                        break;
                    case "LINE":
                        assert(result.coverageStats[i].covered == 2);
                        assert(result.coverageStats[i].total == 7);
                        assert(result.coverageStats[i].position == 4);
                        break;
                    case "COMPLEXITY":
                        assert(result.coverageStats[i].covered == 2);
                        assert(result.coverageStats[i].total == 6);
                        assert(result.coverageStats[i].position == 2);
                        break;
                    case "METHOD":
                        assert(result.coverageStats[i].covered == 2);
                        assert(result.coverageStats[i].total == 6);
                        assert(result.coverageStats[i].position == 3);
                        break;
                    case "CLASS":
                        assert(result.coverageStats[i].covered == 2);
                        assert(result.coverageStats[i].total == 2);
                        assert(result.coverageStats[i].position == 1);
                        break;
                    default: assert(false, "Unexpected code coverage stat . label : " + result.coverageStats[i].label)
                }
            }
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
            });
    })

    it('codecoverage.publish : publish code coverage files without report directory and additional files', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": jacocoSummaryFile, "codecoveragetool": "JaCoCo", "reportdirectory": "", "additionalcodecoveragefiles": "" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        var jobInfo = new jobInf.TestJobInfo({});
        jobInfo.variables = { "agent.workingDirectory": __dirname, "build.buildId": "1" };
        testExecutionContext = new tec.TestExecutionContext(jobInfo);

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(testExecutionContext.service.containerItems.length == 1);
            assert(testExecutionContext.service.artifactNames.length == 1);
            assert(testExecutionContext.service.artifactNames[0] == "Code Coverage Report_1")
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
                done();
            });
    })

    it('codecoverage.publish : publish code coverage files with report directory and without additional files', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": coberturaSummaryFile, "codecoveragetool": "Cobertura", "reportdirectory": reportDirectory, "additionalcodecoveragefiles": "" };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        var jobInfo = new jobInf.TestJobInfo({});
        jobInfo.variables = { "agent.workingDirectory": __dirname, "build.buildId": "1" };
        testExecutionContext = new tec.TestExecutionContext(jobInfo);

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(testExecutionContext.service.containerItems.length == 8);
            assert(testExecutionContext.service.artifactNames.length == 1);
            assert(testExecutionContext.service.artifactNames[0] == "Code Coverage Report_1")
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
                done();
            });
    })

    it('codecoverage.publish : publish code coverage files with report directory and additional files', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": coberturaSummaryFile, "codecoveragetool": "Cobertura", "reportdirectory": reportDirectory, "additionalcodecoveragefiles": jacocoSummaryFile + "," + coberturaSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        var jobInfo = new jobInf.TestJobInfo({});
        jobInfo.variables = { "agent.workingDirectory": __dirname, "build.buildId": "1" };
        testExecutionContext = new tec.TestExecutionContext(jobInfo);

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(testExecutionContext.service.containerItems.length == 10);
            assert(testExecutionContext.service.artifactNames.length == 2);
            assert(testExecutionContext.service.artifactNames[0] == "Code Coverage Report_1")
            assert(testExecutionContext.service.artifactNames[1] == "Code Coverage Files_1")
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
                done();
            });
    })

    it('codecoverage.publish : publish code coverage files with out report directory and with additional files', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": coberturaSummaryFile, "codecoveragetool": "Cobertura", "reportdirectory": "", "additionalcodecoveragefiles": jacocoSummaryFile + "," + coberturaSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        var jobInfo = new jobInf.TestJobInfo({});
        jobInfo.variables = { "agent.workingDirectory": __dirname, "build.buildId": "1" };
        testExecutionContext = new tec.TestExecutionContext(jobInfo);

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(testExecutionContext.service.containerItems.length == 3);
            assert(testExecutionContext.service.artifactNames.length == 2);
            assert(testExecutionContext.service.artifactNames[0] == "Code Coverage Report_1")
            assert(testExecutionContext.service.artifactNames[1] == "Code Coverage Files_1")
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
                done();
            });
    })

    it('codecoverage.publish : publish code coverage files when publishing report directory fails', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": coberturaSummaryFile, "codecoveragetool": "Cobertura", "reportdirectory": reportDirectory, "additionalcodecoveragefiles": jacocoSummaryFile + "," + coberturaSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        var jobInfo = new jobInf.TestJobInfo({});
        jobInfo.variables = { "agent.workingDirectory": __dirname, "build.buildId": "1" };
        testExecutionContext = new tec.TestExecutionContext(jobInfo);
        testExecutionContext.service.failingArtifactName = "Code Coverage Report_1";

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                assert(testExecutionContext.service.containerItems.length == 8);
                assert(testExecutionContext.service.artifactNames.length == 1);
                assert(testExecutionContext.service.artifactNames[0] == "Code Coverage Report_1")
                assert(err == "Error: Error occured while publishing artifact")
                done();
            });
    })

    it('codecoverage.publish : publish code coverage files when publishing raw directory fails', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": coberturaSummaryFile, "codecoveragetool": "Cobertura", "reportdirectory": reportDirectory, "additionalcodecoveragefiles": jacocoSummaryFile + "," + coberturaSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        var jobInfo = new jobInf.TestJobInfo({});
        jobInfo.variables = { "agent.workingDirectory": __dirname, "build.buildId": "1" };
        testExecutionContext = new tec.TestExecutionContext(jobInfo);
        testExecutionContext.service.failingArtifactName = "Code Coverage Files_1";

        var codeCoveragePublishCommand = new cpc.CodeCoveragePublishCommand(testExecutionContext, command);
        codeCoveragePublishCommand.runCommandAsync().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                assert(testExecutionContext.service.containerItems.length == 10);
                assert(testExecutionContext.service.artifactNames.length == 2);
                assert(testExecutionContext.service.artifactNames[0] == "Code Coverage Report_1");
                assert(testExecutionContext.service.artifactNames[1] == "Code Coverage Files_1")
                assert(err == "Error: Error occured while publishing artifact")
                done();
            });
    })
});	
