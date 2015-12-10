// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import path = require('path');
import fm = require('./lib/feedback');
import trp = require('../agent/testrunpublisher');
import trr = require('../agent/testresultreader');
import ifm = require('../agent/interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');

describe('PublisherTests', function() {
		
	it('results.publish : JUnit results file', function(done) {
		this.timeout(2000);

        var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "",
            config: "",
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "",
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
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "",
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
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "",
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
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "",
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
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "",
            releaseUri: "",
            releaseEnvironmentUri: ""
        };
        var reader = new trr.JUnitResultReader();
        var feedbackChannel: fm.TestFeedbackChannel = new fm.TestFeedbackChannel();
		var testRunPublisher = new trp.TestRunPublisher(feedbackChannel, null, "teamProject", runContext, reader);
		var resultsFile = path.resolve(__dirname, './testresults/junitresults1.xml');
		var testRun = {
	        name: "foobar",
	        id: -1,
			resultsFile: resultsFile
	    };

	    // error handling/propagation from end test run 
		testRunPublisher.endTestRun(testRun.id, testRun.resultsFile).then(function (createdTestRun) {
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
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "",
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

	it('results.publish : JUnit reader sanity check without run title', function(done) {
		var results;
		var testRun;
		var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "mac",
            config: "debug",
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "0",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
        };
		var resultsFile = path.resolve(__dirname, './testresults/junitresults1.xml');
		var reader = new trr.JUnitResultReader();
		//var testRunWithResults = reader.readResults(resultsFile, runContext);
		reader.readResults(resultsFile, runContext).then(function (res) {
			testRun = res.testRun;
			results = res.testResults;
			
			//Verifying the test run details
			assert.strictEqual("JUnitXmlReporter", testRun.name);
			//assert.equal("", testRun.startDate);
			//assert.equal("", testRun.completeDate);
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
		var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "mac",
            config: "debug",
			runTitle: "My Title",
			publishRunAttachments: true,
			fileNumber: "0",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
        };
		var resultsFile = path.resolve(__dirname, './testresults/junitresults1.xml');
		var reader = new trr.JUnitResultReader();
		//var testRunWithResults = reader.readResults(resultsFile, runContext);
		reader.readResults(resultsFile, runContext).then(function (res) {
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
		var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "mac",
            config: "debug",
			runTitle: "My Title",
			publishRunAttachments: true,
			fileNumber: "4",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
        };
		var resultsFile = path.resolve(__dirname, './testresults/junitresults1.xml');
		var reader = new trr.JUnitResultReader();
		//var testRunWithResults = reader.readResults(resultsFile, runContext);
		reader.readResults(resultsFile, runContext).then(function (res) {
			testRun = res.testRun;
			
			//Verifying the test run details
			assert.strictEqual("My Title 4", testRun.name);			
			done();
		},
		function(err) {
			assert(false, 'JUnit Reader Failed! Details : ' + err.message);
			done();
		});		
	})
	
	it('results.publish : NUnit reader sanity check without run title', function (done) {
		
		var results;
		var runContext: trp.TestRunContext = {
			requestedFor: "userx",
            buildId: "21",
            platform: "mac",
            config: "debug",
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "0",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
		};
		var reader = new trr.NUnitResultReader();
		var resultsFile = path.resolve(__dirname, './testresults/nunitresults.xml');
		var testRun;

		reader.readResults(resultsFile, runContext).then(function (res) {
			testRun = res.testRun;
			results = res.testResults;
			
			//Verifying the test run details
			assert.strictEqual("/Volumes/Data/xamarin/workspaces/android-csharp-test-job-c2a0f46d-7bf3-4ba8-97ce-ce8a8fdd1c4720150429-96377-8lrqzf/CreditCardValidation.Tests.dll", testRun.name);
			//assert.equal("", testRun.startDate);
			//assert.equal("", testRun.completeDate);
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
		var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "mac",
            config: "debug",
			runTitle: "My Title",
			publishRunAttachments: true,
			fileNumber: "0",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
        };
		var resultsFile = path.resolve(__dirname, './testresults/nunitresults.xml');
		var reader = new trr.NUnitResultReader();
		//var testRunWithResults = reader.readResults(resultsFile, runContext);
		reader.readResults(resultsFile, runContext).then(function (res) {
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
		var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "mac",
            config: "debug",
			runTitle: "My Title",
			publishRunAttachments: true,
			fileNumber: "11",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
        };
		var resultsFile = path.resolve(__dirname, './testresults/nunitresults.xml');
		var reader = new trr.NUnitResultReader();
		//var testRunWithResults = reader.readResults(resultsFile, runContext);
		reader.readResults(resultsFile, runContext).then(function (res) {
			testRun = res.testRun;
			
			//Verifying the test run details
			assert.strictEqual("My Title 11", testRun.name);			
			done();
		},
		function(err) {
			assert(false, 'NUnit Reader Failed! Details : ' + err.message);
			done();
		});		
	})
	
	
    it('results.publish : XUnit reader sanity check without run title', function (done) {
        var results;
        var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "mac",
            config: "debug",
			runTitle: "",
			publishRunAttachments: true,
			fileNumber: "0",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
        };
        var reader = new trr.XUnitResultReader();
        var resultsFile = path.resolve(__dirname, './testresults/xunitresults.xml');
        var testRun;
		
		reader.readResults(resultsFile, runContext).then(function (res) {
			testRun = res.testRun;
			results = res.testResults;
			
			//Verifying the test run details
			assert.strictEqual("XUnit Test Run debug mac", testRun.name);
			//assert.equal("", testRun.startDate);
			//assert.equal("", testRun.completeDate);
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
		var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "mac",
            config: "debug",
			runTitle: "My Title",
			publishRunAttachments: true,
			fileNumber: "0",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
        };
		var resultsFile = path.resolve(__dirname, './testresults/xunitresults.xml');
		var reader = new trr.XUnitResultReader();
		//var testRunWithResults = reader.readResults(resultsFile, runContext);
		reader.readResults(resultsFile, runContext).then(function (res) {
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
		var runContext: trp.TestRunContext = {
            requestedFor: "userx",
            buildId: "21",
            platform: "",
            config: "",
			runTitle: "My Title",
			publishRunAttachments: true,
			fileNumber: "9",
            releaseUri: "abc",
            releaseEnvironmentUri: "xyz"
        };
		var resultsFile = path.resolve(__dirname, './testresults/xunitresults.xml');
		var reader = new trr.XUnitResultReader();
		//var testRunWithResults = reader.readResults(resultsFile, runContext);
		reader.readResults(resultsFile, runContext).then(function (res) {
			testRun = res.testRun;
			
			//Verifying the test run details
			assert.strictEqual("My Title 9", testRun.name);			
			done();
		},
		function(err) {
			assert(false, 'XUnit Reader Failed! Details : ' + err.message);
			done();
		});		
	})
});	
