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

describe('PublisherTests', function() {

    var runContext: trp.TestRunContext = {
        requestedFor: "userx",
        buildId: "21",
        platform: "mac",
        config: "debug",
        runTitle: "My Title",
        publishRunAttachments: true,
        //fileNumber: "3",
        releaseUri: "abc",
        releaseEnvironmentUri: "xyz"
    };

    var command: cm.ITaskCommand;
    var readerJUnit = new trr.JUnitResultReader(command);
    var readerNUnit = new trr.NUnitResultReader(command);
    var readerXUnit = new trr.XUnitResultReader(command);

    var resultsFileJUnit = path.resolve(__dirname, './testresults/junitresults1.xml');
    var resultstFileJUnitMultiNode = path.resolve(__dirname, './testresults/Junit_test2.xml');
    var resultsFileNUnit = path.resolve(__dirname, './testresults/nunitresults.xml');
    var resultsFileXUnit = path.resolve(__dirname, './testresults/xunitresults.xml');

    var feedbackChannel;
    var testRunPublisher;

    it('results.publish : JUnit results file', function(done) {
        this.timeout(2000);

        feedbackChannel = new fm.TestFeedbackChannel();
        testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);

        testRunPublisher.publishTestRun(resultsFileJUnit).then(function(createdTestRun) {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
            done();
        },
            function(err) {
                assert(false, 'ResultPublish Task Failed! Details : ' + err.message);
            });
    })

    it('results.publish : JUnit results file with multiple test suite nodes (karma format)', function(done) {
        this.timeout(2000);

        feedbackChannel = new fm.TestFeedbackChannel();
        testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);

        testRunPublisher.publishTestRun(resultstFileJUnitMultiNode).then(function(createdTestRun) {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
            done();
        },
            function(err) {
                assert(false, 'ResultPublish Task Failed! Details : ' + err.message);
            });
    })

    it('results.publish : NUnit results file', function(done) {
        this.timeout(2000);
        feedbackChannel = new fm.TestFeedbackChannel();
        testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerNUnit);

        testRunPublisher.publishTestRun(resultsFileNUnit).then(function(createdTestRun) {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
            done();
        },
            function(err) {
                assert(false, 'ResultPublish Task Failed! Details : ' + err.message);
            });
    })

    it('results.publish : XUnit results file', function(done) {
        this.timeout(2000);

        feedbackChannel = new fm.TestFeedbackChannel();
        testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerXUnit);

        testRunPublisher.publishTestRun(resultsFileXUnit).then(function(createdTestRun) {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
            done();
        },
            function(err) {
                assert(false, 'ResultPublish Task Failed! Details : ' + err.message);
            });
    })
    /*
        it('results.publish : error handling for create test run', function(done) {
            this.timeout(2000);
    
            feedbackChannel = new fm.TestFeedbackChannel();
            testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);
    
            var testRun: testifm.RunCreateModel = <any>{
                name: "foobar",
                id: -1
            };
    
            // error handling/propagation from start test run 
            testRunPublisher.startTestRun(testRun).then(function (createdTestRun) {
                assert(false, 'ResultPublish Task did not fail as expected');
                done();
            },
            function (err) {
                assert(err.message == "Too bad - createTestRun failed", 'ResultPublish Task error message does not match expected - ' + err.message);
                done();
            });
    
        })	
    */
    it('results.publish : error handling for end test run', function(done) {
        this.timeout(2000);

        feedbackChannel = new fm.TestFeedbackChannel();
        testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);
        var testRun = {
            name: "foobar",
            id: -1,
            resultsFile: resultsFileJUnit
        };

        // error handling/propagation from end test run 
        testRunPublisher.endTestRun(testRun.id, testRun.resultsFile).then(function(createdTestRun) {
            assert(false, 'ResultPublish Task did not fail as expected');
            done();
        },
            function(err) {
                assert(err.message == "Too bad - endTestRun failed", 'ResultPublish Task error message does not match expected - ' + err.message);
                done();
            });
    })

    it('results.publish : error handling for reading results', function(done) {
        this.timeout(2000);

        feedbackChannel = new fm.TestFeedbackChannel();
        testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, readerJUnit);

        // error handling/propagation from parsing failures of junit/nunit files
        var resultsFile = path.resolve(__dirname, './testresults/junit_bad.xml');
        testRunPublisher.publishTestRun(resultsFile).then(function(createdTestRun) {
            assert(!feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
        },
            function(err) {
                assert(err.message == "Unmatched closing tag: XYZXYZuite\nLine: 13\nColumn: 16\nChar: >",
                    'ResultPublish Task Failed as expected! Details : ' + err.message);
                done();
            });
    })

    it('results.publish : JUnit reader sanity check without run title', function(done) {

        var results;
        var testRun;

        runContext.runTitle = "";
        //runContext.fileNumber = "0";

        readerJUnit.readResults(resultsFileJUnit, runContext).then(function(res) {
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
            done();
        },
            function(err) {
                assert(false, 'JUnit Reader Failed! Details : ' + err.message);
                done();
            });
    })

    it('results.publish : JUnit reader sanity check with run title', function(done) {

        var testRun;

        runContext.runTitle = "My Title";
        // runContext.fileNumber = "0";

        readerJUnit.readResults(resultsFileJUnit, runContext).then(function(res) {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title", testRun.name);
            done();
        },
            function(err) {
                assert(false, 'JUnit Reader Failed! Details : ' + err.message);
                done();
            });
    })

    it('results.publish : JUnit reader sanity check with run title and file number', function(done) {

        var testRun;

        //runContext.fileNumber = "3";

        readerJUnit.readResults(resultsFileJUnit, runContext).then(function(res) {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title 3", testRun.name);
            done();
        },
            function(err) {
                assert(false, 'JUnit Reader Failed! Details : ' + err.message);
                done();
            });
    })

    it('results.publish : NUnit reader sanity check without run title', function(done) {

        var results;
        var testRun;

        runContext.runTitle = "";
        //runContext.fileNumber = "0";

        readerNUnit.readResults(resultsFileNUnit, runContext).then(function(res) {
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
            done();
        },
            function(err) {
                assert(false, 'NUnit Reader Failed! Details : ' + err.message);
                done();
            });
    })

    it('results.publish : NUnit reader sanity check with run title', function(done) {

        var testRun;

        runContext.runTitle = "My Title";
        //runContext.fileNumber = "0";

        readerNUnit.readResults(resultsFileNUnit, runContext).then(function(res) {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title", testRun.name);
            done();
        },
            function(err) {
                assert(false, 'NUnit Reader Failed! Details : ' + err.message);
                done();
            });
    })

    it('results.publish : NUnit reader sanity check with run title and file number', function(done) {

        var testRun;
        //runContext.fileNumber = "3";

        readerNUnit.readResults(resultsFileNUnit, runContext).then(function(res) {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title 3", testRun.name);
            done();
        },
            function(err) {
                assert(false, 'NUnit Reader Failed! Details : ' + err.message);
                done();
            });
    })


    it('results.publish : XUnit reader sanity check without run title', function(done) {

        var results;
        var testRun;

        runContext.runTitle = "";
        // runContext.fileNumber = "0";

        readerXUnit.readResults(resultsFileXUnit, runContext).then(function(res) {
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
            done();
        },
            function(err) {
                assert(false, 'XUnit Reader Failed! Details : ' + err.message);
                done();
            });
    })

    it('results.publish : XUnit reader sanity check with run title', function(done) {

        var testRun;

        runContext.runTitle = "My Title";
        // runContext.fileNumber = "0";

        readerXUnit.readResults(resultsFileXUnit, runContext).then(function(res) {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title", testRun.name);
            done();
        },
            function(err) {
                assert(false, 'XUnit Reader Failed! Details : ' + err.message);
                done();
            });
    })

    it('results.publish : XUnit reader sanity check with run title and file number', function(done) {

        var testRun;

        // runContext.fileNumber = "3";
        readerXUnit.readResults(resultsFileXUnit, runContext).then(function(res) {
            testRun = res.testRun;

            //Verifying the test run details
            assert.strictEqual("My Title 3", testRun.name);
            done();
        },
            function(err) {
                assert(false, 'XUnit Reader Failed! Details : ' + err.message);
                done(err);
            }).fail(function(err) {
                assert(false, 'XUnit Reader Failed! Details : ' + err.message);
                done(err);
            });
    })
});	
