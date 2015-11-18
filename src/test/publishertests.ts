// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import path = require('path');
import fm = require('./lib/feedback');
import trp = require('../agent/testrunpublisher');
import trr = require('../agent/testresultreader');
import testifm = require('vso-node-api/interfaces/TestInterfaces');

describe('PublisherTests', function() {
		
	it('results.publish : JUnit results file', function(done) {
		this.timeout(2000);

        var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "",
            config: "",
            releaseUri: "",
            releaseEnvironmentUri: ""
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
    	
	it('results.publish : NUnit results file', function (done) {
		this.timeout(2000);

		var runContext: trp.TestRunContext = {
			requestedFor: "userx",
			buildId: "21",
			platform: "",
            config: "",
            releaseUri: "",
            releaseEnvironmentUri: ""
		};
		var reader = new trr.NUnitResultReader();
		var resultsFile = path.resolve(__dirname, './testresults/nunitresults.xml');
		var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
		var testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, reader);

		testRunPublisher.publishTestRun(resultsFile).then(function (createdTestRun) {
			assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
			done();
		},
		function (err) {
			assert(false, 'ResultPublish Task Failed! Details : ' + err.message);
		});
    })	

    it('results.publish : XUnit results file', function (done) {
        this.timeout(2000);

        var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "",
            config: "",
            releaseUri: "",
            releaseEnvironmentUri: ""
        };
        var reader = new trr.XUnitResultReader();
        var resultsFile = path.resolve(__dirname, './testresults/xunitresults.xml');
        var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
        var testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, reader);

        testRunPublisher.publishTestRun(resultsFile).then(function (createdTestRun) {
            assert(feedbackChannel.jobsCompletedSuccessfully(), 'ResultPublish Task Failed! Details : ' + feedbackChannel.getRecordsString());
            done();
        },
            function (err) {
                assert(false, 'ResultPublish Task Failed! Details : ' + err.message);
            });
    })

	it('results.publish : error handling for create test run', function(done) {
		this.timeout(2000);

        var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "",
            config: "",
            releaseUri: "",
            releaseEnvironmentUri: ""
        };
        var reader = new trr.JUnitResultReader();
        var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
		var testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, reader);
		var resultsFile = path.resolve(__dirname, './testresults/junitresults1.xml');
		var testRun: testifm.RunCreateModel = <any>{
	        name: "foobar",
	        id: -1
	    };

	    // error handling/propagation from start test run 
		testRunPublisher.startTestRun(testRun, resultsFile).then(function (createdTestRun) {
			assert(false, 'ResultPublish Task did not fail as expected');
            done();
        },
        function (err) {
            assert(err.message == "Too bad - createTestRun failed", 'ResultPublish Task error message does not match expected - ' + err.message);
            done();
        });

    })	
    	
	it('results.publish : error handling for end test run', function(done) {
		this.timeout(2000);

        var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "",
            config: "",
            releaseUri: "",
            releaseEnvironmentUri: ""
        };
        var reader = new trr.JUnitResultReader();
        var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
		var testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, reader);
		var resultsFile = path.resolve(__dirname, './testresults/junitresults1.xml');
		var testRun = {
	        name: "foobar",
	        id: -1
	    };

	    // error handling/propagation from end test run 
		testRunPublisher.endTestRun(testRun.id).then(function (createdTestRun) {
			assert(false, 'ResultPublish Task did not fail as expected');
            done();
        },
        function (err) {
            assert(err.message == "Too bad - endTestRun failed", 'ResultPublish Task error message does not match expected - ' + err.message);
            done();
        });
    }) 
           
	it('results.publish : error handling for reading results', function(done) {
		this.timeout(2000);

        var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "",
            config: "",
            releaseUri: "",
            releaseEnvironmentUri: ""
        };
        var reader = new trr.JUnitResultReader();
        var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
		var testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, reader);
		var resultsFile = path.resolve(__dirname, './testresults/junitresults1.xml');
		
        // error handling/propagation from parsing failures of junit/nunit files
		resultsFile = path.resolve(__dirname, './testresults/junit_bad.xml');
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
