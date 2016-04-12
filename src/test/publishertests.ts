// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import path = require('path');
import fm = require('./lib/feedback');
import trp = require('../agent/testrunpublisher');
import trr = require('../agent/testresultreader');
import cm = require('../agent/common');
import ifm = require('../agent/interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import tc = require('./lib/testcommand');
import rp = require('../agent/commands/results.publish');
import tec = require('./lib/testExecutionContext');

var jobInf = require('./lib/testJobInfo');

function resultFile(filename: string) {
    return path.resolve(__dirname, 'testresults', filename);
}

describe('PublisherTests', function() {
    const runContext: trp.TestRunContext = {
        requestedFor: "userx",
        buildId: "21",
        platform: "mac",
        config: "debug",
        runTitle: "My Title",
        publishRunAttachments: true,
        fileNumber: "3",
        releaseUri: "abc",
        releaseEnvironmentUri: "xyz"
    };

    let command: cm.ITaskCommand;
    const readerJUnit = new trr.JUnitResultReader(command);
    const readerNUnit = new trr.NUnitResultReader(command);
    const readerXUnit = new trr.XUnitResultReader(command);
    const emptyFile = resultFile('empty.xml');
    const resultsFileJUnit = resultFile('junitresults1.xml');
    const resultsFileJUnit2 = resultFile('junitresults2.xml');
    const resultstFileJUnitMultiNode = resultFile('Junit_test2.xml');
    const resultsFileJUnitNoTestCases = resultFile('junit_with_no_test_cases.xml');
    const resultsFileJUnitNoTestSuites = resultFile('junit_with_no_test_suites.xml');
    const resultsFileNUnit = resultFile('nunitresults.xml');
    const resultsFileNUnit2 = resultFile('nunitresults.1.xml');
    const resultsFileXUnit = resultFile('xunitresults.xml');
    const resultsFileXUnit2 = resultFile('xunitresults.1.xml');
    var junitFilePath = path.resolve(__dirname, './testresults/junitresults1.xml');
    var testExecutionContext;

    it('results.publish : JUnit results file', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);

        return testRunPublisher.publishTestRun(resultsFileJUnit).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    });

    it('results.publish : JUnit results file with multiple test suite nodes (karma format)', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);
        return testRunPublisher.publishTestRun(resultstFileJUnitMultiNode).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    });

    it('results.publish : JUnit results file with a suite and no cases', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);
        return testRunPublisher.publishTestRun(resultsFileJUnitNoTestCases).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    });

    it('results.publish : JUnit results file with no suites', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);

        return testRunPublisher.publishTestRun(resultsFileJUnitNoTestSuites).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    });

    it('results.publish : NUnit results file', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerNUnit);

        return testRunPublisher.publishTestRun(resultsFileNUnit).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    });

    it('results.publish : XUnit results file', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerXUnit);

        return testRunPublisher.publishTestRun(resultsFileXUnit).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    });

    it('results.publish : error handling for end test run', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);
        var testRun = {
            name: "foobar",
            id: -1,
            resultsFile: resultsFileJUnit
        };

        // error handling/propagation from end test run 
        return testRunPublisher.endTestRun(testRun.id, testRun.resultsFile)
            .then(createdTestRun => assert(false, 'ResultPublish Task did not fail as expected'))
            .catch(err => {
                assert(err.message == "Too bad - endTestRun failed", 'ResultPublish Task error message does not match expected - ' + err.message);
            });
    });

    it('results.publish : error handling for reading results', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);

        // error handling/propagation from parsing failures of junit/nunit files
        var resultsFile = path.resolve(__dirname, './testresults/junit_bad.xml');
        return testRunPublisher.publishTestRun(resultsFile)
            .then(createdTestRun => {
                assert(!feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
            })
            .catch(err => {
                assert(err.message == "Unmatched closing tag: XYZXYZuite\nLine: 13\nColumn: 16\nChar: >",
                    'ResultPublish Task Failed as expected! Details : ' + err.message);
            });
    });

    it('results.publish : JUnit reader sanity check without run title', () => {
        var results;
        var testRun;

        runContext.runTitle = "";
        runContext.fileNumber = "0";

        return readerJUnit.readResults(resultsFileJUnit, runContext).then(res => {
            testRun = res.testRun;
            results = res.testResults;

            //Verifying the test run details
            assert.strictEqual("JUnitXmlReporter", testRun.name);
            assert.equal("debug", testRun.buildFlavor);
            assert.equal("mac", testRun.buildPlatform);
            assert.equal("abc", testRun.releaseUri);
            assert.equal("xyz", testRun.releaseEnvironmentUri);
            assert.equal(21, testRun.build.id);
            assert.strictEqual(true, testRun.automated);


            //Verifying Test Results
            assert.strictEqual(3, results.length);
            assert.strictEqual("should default path to an empty string", results[0].automatedTestName);
            assert.strictEqual("should default consolidate to true", results[1].automatedTestName);
            assert.strictEqual("should default useDotNotation to true", results[2].automatedTestName);
        });
    });

    it('results.publish : JUnit reader sanity check with run title', () => {
        var testRun;

        runContext.runTitle = "My Title";
        runContext.fileNumber = "0";

        return readerJUnit.readResults(resultsFileJUnit, runContext).then(res => {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title", testRun.name);
        });
    });

    it('results.publish : JUnit reader sanity check with run title and file number', () => {
        var testRun;
        runContext.fileNumber = "3";
        return readerJUnit.readResults(resultsFileJUnit, runContext).then(res => {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title 3", testRun.name);
        });
    });

    it('results.publish : NUnit reader sanity check without run title', () => {
        var results;
        var testRun;

        runContext.runTitle = "";
        runContext.fileNumber = "0";

        return readerNUnit.readResults(resultsFileNUnit, runContext).then(res => {
            testRun = res.testRun;
            results = res.testResults;

            //Verifying the test run details
            assert.strictEqual("/Volumes/Data/xamarin/workspaces/android-csharp-test-job-c2a0f46d-7bf3-4ba8-97ce-ce8a8fdd1c4720150429-96377-8lrqzf/CreditCardValidation.Tests.dll", testRun.name);
            assert.equal("debug", testRun.buildFlavor);
            assert.equal("mac", testRun.buildPlatform);
            assert.equal("abc", testRun.releaseUri);
            assert.equal("xyz", testRun.releaseEnvironmentUri);
            assert.equal(21, testRun.build.id);
            assert.strictEqual(true, testRun.automated);


            //Verifying Test Results
            assert.strictEqual(4, results.length);
            assert.strictEqual("CreditCardValidation.Tests.ValidateCreditCardTests.CreditCardNumber_CorrectSize_DisplaySuccessScreen(Android)_lg_nexus_5_4_4_4", results[0].automatedTestName);
            assert.strictEqual("CreditCardValidation.Tests.ValidateCreditCardTests.CreditCardNumber_IsBlank_DisplayErrorMessage(Android)_lg_nexus_5_4_4_4", results[1].automatedTestName);
            assert.strictEqual("CreditCardValidation.Tests.ValidateCreditCardTests.CreditCardNumber_TooLong_DisplayErrorMessage(Android)_lg_nexus_5_4_4_4", results[2].automatedTestName);
            assert.strictEqual("CreditCardValidation.Tests.ValidateCreditCardTests.CreditCardNumber_TooShort_DisplayErrorMessage(Android)_lg_nexus_5_4_4_4", results[3].automatedTestName);
        });
    });

    it('results.publish : NUnit reader sanity check with run title', () => {
        var testRun;
        runContext.runTitle = "My Title";
        runContext.fileNumber = "0";
        return readerNUnit.readResults(resultsFileNUnit, runContext).then(res => {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title", testRun.name);
        });
    });

    it('results.publish : NUnit reader sanity check with run title and file number', () => {
        var testRun;
        runContext.fileNumber = "3";

        return readerNUnit.readResults(resultsFileNUnit, runContext).then(res => {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title 3", testRun.name);
        });
    });

    it('results.publish : XUnit reader sanity check without run title', () => {
        var results;
        var testRun;

        runContext.runTitle = "";
        runContext.fileNumber = "0";
        return readerXUnit.readResults(resultsFileXUnit, runContext).then(res => {
            testRun = res.testRun;
            results = res.testResults;

            //Verifying the test run details
            assert.strictEqual("XUnit Test Run debug mac", testRun.name);
            assert.equal("debug", testRun.buildFlavor);
            assert.equal("mac", testRun.buildPlatform);
            assert.equal("abc", testRun.releaseUri);
            assert.equal("xyz", testRun.releaseEnvironmentUri);
            assert.equal(21, testRun.build.id);
            assert.strictEqual(true, testRun.automated);


            //Verifying Test Results
            assert.strictEqual(4, results.length);
            assert.strictEqual("FailingTest", results[0].automatedTestName);
            assert.strictEqual("PassingTest", results[1].automatedTestName);
            assert.strictEqual("tset2", results[2].automatedTestName);
            assert.strictEqual("test1", results[3].automatedTestName);
        });
    });

    it('results.publish : XUnit reader sanity check with run title', () => {
        var testRun;

        runContext.runTitle = "My Title";
        runContext.fileNumber = "0";

        return readerXUnit.readResults(resultsFileXUnit, runContext).then(res => {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title", testRun.name);
        });
    });

    it('results.publish : XUnit reader sanity check with run title and file number', () => {
        var testRun;

        runContext.fileNumber = "3";
        return readerXUnit.readResults(resultsFileXUnit, runContext).then(res => {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title 3", testRun.name);
        });
    });

    it('results.publish : JUnit results file with merge support', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);

        return testRunPublisher.publishMergedTestRun([resultsFileJUnit, resultsFileJUnit2]).then(createTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    })

    it('results.publish : NUnit results file with merge support', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerNUnit);

        return testRunPublisher.publishMergedTestRun([resultsFileNUnit, resultsFileNUnit2]).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    })

    it('results.publish : XUnit results file with merge support', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerXUnit);

        return testRunPublisher.publishMergedTestRun([resultsFileXUnit, resultsFileXUnit2]).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    })

    it('results.publish : JUnit results file with merge support with one invalid xml file', () => {
        const feedbackChannel = new fm.TestFeedbackChannel();
        const testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerXUnit);

        return testRunPublisher.publishMergedTestRun([resultsFileJUnit, resultsFileJUnit2, emptyFile]).then(createdTestRun => {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        });
    })

    it('results.publish : Publish Test Results with old task compat', () => {
        var properties: { [name: string]: string } = { "type": "junit", "platform": "platform", "config": "config", "runTitle": "Test Title", "publishRunAttachments": "true", "fileNumber": "1" };
        var message = junitFilePath;
        var command: cm.ITaskCommand = new tc.TestCommand(null, properties, message);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));
        testExecutionContext.variables['system.teamProject'] = "teamProject";
        var testResultsPublisher = new rp.ResultsPublishCommand(testExecutionContext, command);

        testResultsPublisher.runCommandAsync().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully());
        },
            function(err) {
                assert(false, 'Publish Test Results failed for old tasks: ' + testExecutionContext.service.getRecordsString())
            });
    })
});	
