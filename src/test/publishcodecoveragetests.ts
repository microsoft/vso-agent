// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import path = require('path');
import fm = require('./lib/feedback');
import tec = require('./lib/testExecutionContext');
import ccp = require('../agent/codecoveragepublisher');
import csr = require('../agent/codecoveragesummaryreader');
import cm = require('../agent/common');
import ifm = require('../agent/interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import tc = require('./lib/testcommand');
import ctxm = require('../agent/context');

var jobInf = require('./lib/testJobInfo');

describe('CodeCoveragePublisherTests', function() {

    var jacocoSummaryFile = path.resolve(__dirname, './codecoveragefiles/jacoco.xml');
    var coberturaSummaryFile = path.resolve(__dirname, './codecoveragefiles/cobertura.xml');
    var invalidJacocoSummaryFile = path.resolve(__dirname, './codecoveragefiles/invalidjacoco.xml');
    var invalidCoberturaSummaryFile = path.resolve(__dirname, './codecoveragefiles/invalidcobertura.xml');
    var emptyJacocoSummaryFile = path.resolve(__dirname, './codecoveragefiles/emptyjacoco.xml');
    var emptyCoberturaSummaryFile = path.resolve(__dirname, './codecoveragefiles/emptycobertura.xml');

    var testExecutionContext;

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

        var properties: { [name: string]: string } = { "summaryfile": jacocoSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var jacocoSummaryReader = new csr.JacocoSummaryReader(command);
        var jobInfo = new jobInf.TestJobInfo({});
        jobInfo.variables = { "build.buildId": "-1" };
        testExecutionContext = new tec.TestExecutionContext(jobInfo);

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, jacocoSummaryReader);
        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
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

        var properties: { [name: string]: string } = { "summaryfile": invalidJacocoSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var jacocoSummaryReader = new csr.JacocoSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, jacocoSummaryReader);
        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                var expectedMessage = "Error: Unexpected close tag" + "\n" + "Line: 11" + "\n" + "Column: 15" + "\n" + "Char: >";
                assert(err == expectedMessage, "");
                done();
            });
    })

    it('codecoverage.publish : publish cobertura summary fails when summary xml is invalid', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": invalidCoberturaSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, coberturaSummaryReader);
        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
            assert(false, 'Publish code coverage Task did not fail as expected')
            done();
        },
            function(err) {
                var expectedMessage = "Error: Unexpected close tag" + "\n" + "Line: 108" + "\n" + "Column: 13" + "\n" + "Char: >";
                assert(err == expectedMessage, "");
                done();
            });
    })

    it('codecoverage.publish : publish jacoco summary when there is no code coverage data', function(done) {
        this.timeout(2000);

        var properties: { [name: string]: string } = { "summaryfile": emptyJacocoSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var jacocoSummaryReader = new csr.JacocoSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, jacocoSummaryReader);
        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
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

        var properties: { [name: string]: string } = { "summaryfile": emptyCoberturaSummaryFile };
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties = properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, coberturaSummaryReader);
        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
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
});	
