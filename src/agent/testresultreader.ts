import ifm = require('./api/interfaces');
import trp = require('./testrunpublisher');

var fs = require('fs');
var path = require("path");
var xmlreader = require('xmlreader');

export class JUnitResultReader implements trp.IResultReader {
    public readResults(file: string, runContext: trp.TestRunContext) {
        var testRun2: ifm.TestRun2;
        var contents = fs.readFileSync(file, "ascii");

        var buildId = runContext.buildId;
        var buildRequestedFor = runContext.requestedFor;
        var platform = "";
        var config = "";

        xmlreader.read(contents, function (err, res) {

            if (err) return console.log(err);

            // read test run summary - runname, host, start time, run duration
            var runName = "JUnit";
            var hostName = "";
            var timeStamp = new Date();
            var totalRunDuration = 0;
            var totalTestCaseDuration = 0;

            var rootNode = res.testsuite.at(0);
            if(rootNode) {
                if(rootNode.attributes().name) {
                    runName = rootNode.attributes().name;
                }

                if(rootNode.attributes().hostname) {
                    hostName = rootNode.attributes().hostname;
                }

                //assume runtimes from xl are current local time since timezone information is not in the xml. If xml date > current local date, fall back to local
                if(rootNode.attributes().timestamp) {
                    var timestampFromXml = rootNode.attributes().timestamp;
                    if(timestampFromXml < new Date()) {
                        timeStamp = timestampFromXml;
                    }                    
                }

                if(rootNode.attributes().time) {
                    totalRunDuration = rootNode.attributes().time;
                }

                //find test case nodes in JUnit result xml
                var testResults = [];

                for(var i = 0; i < rootNode.testcase.count(); i ++) {
                    var testCaseNode = rootNode.testcase.at(i);

                    //testcase name and type
                    var testName = "";
                    if(testCaseNode.attributes().name) {
                        testName = testCaseNode.attributes().name;                    
                    } 

                    var testStorage = "";
                    if(testCaseNode.attributes().classname) {
                        testStorage = testCaseNode.attributes().classname;
                    }

                    //testcase duration
                    var testCaseDuration = 0; //in seconds
                    if(testCaseNode.attributes().time) {
                        testCaseDuration = testCaseNode.attributes().time;
                        totalTestCaseDuration = totalTestCaseDuration + testCaseDuration;
                    }
                    
                    //testcase outcome
                    var outcome = "Passed";
                    var errorMessage = "";
                    if(testCaseNode.failure) {
                        outcome = "Failed";
                        errorMessage = testCaseNode.failure.text();
                    }
                    else if(testCaseNode.error) {
                        outcome = "Failed";
                        errorMessage = testCaseNode.error.text();
                    }

                    var testResult : ifm.TestRunResult = <ifm.TestRunResult> {
                        state: "Completed",
                        computerName: hostName,
                        resolutionState: null,
                        testCasePriority: 1,
                        failureType: null,
                        automatedTestName: testName,
                        automatedTestStorage: testStorage,
                        automatedTestType: "JUnit",
                        automatedTestTypeId: null,
                        automatedTestId: null,
                        area: null,
                        owner: buildRequestedFor, 
                        runBy: buildRequestedFor,
                        testCaseTitle: testName,
                        revision: 0,
                        dataRowCount: 0,
                        testCaseRevision: 0,
                        outcome: outcome,
                        errorMessage: errorMessage,
                        durationInMs: totalTestCaseDuration * 1000, //convert to milliseconds
                    };
                    
                    testResults.push(testResult);
                }

                if(totalRunDuration < totalTestCaseDuration) {
                    totalRunDuration = totalTestCaseDuration; //run duration may not be set in the xml, so use the testcase duration
                }
            }    

            var completedDate = timeStamp;
            completedDate.setSeconds(timeStamp.getSeconds() + totalRunDuration);
            
            //create test run data
            var testRun: ifm.TestRun = <ifm.TestRun>    {
                name: runName,
                iteration: "",
                state: "InProgress",
                automated: true,
                errorMessage: "",
                type: "",
                controller: "",
                buildDropLocation: "",
                buildPlatform: platform,
                buildFlavor: config,
                comment: "",
                testEnvironmentId: "",
                startDate: timeStamp,
                //completeDate: completedDate,
                releaseUri: "",
                build: { id: buildId}
            };

            testRun2 = <ifm.TestRun2>{
                testRun : testRun,
                testResults: testResults
            };
        });
        
        return testRun2;

    }
}

//-----------------------------------------------------
// Read NUnit results from a file
// - file: string () - location of the NUnit results file 
//-----------------------------------------------------
export class NUnitResultReader implements trp.IResultReader {
    public readResults(file: string, runContext: trp.TestRunContext) {
        var testRun2: ifm.TestRun2;

        var contents = fs.readFileSync(file, "ascii");
        var buildId = runContext.buildId;
        var buildRequestedFor = runContext.requestedFor;
        var platform = "";
        var config = "";

        xmlreader.read(contents, function (err, res){

            if(err) return console.log(err);

            //read test run summary - runname, host, start time, run duration
            var runName = "JUnit";
            var hostName = "";
            var timeStamp = new Date(); 
            var totalRunDuration = 0;
            var totalTestCaseDuration = 0;

            var rootNode = res.testsuite.at(0);
            if(rootNode) {
                if(rootNode.attributes().name) {
                    runName = rootNode.attributes().name;
                }

                if(rootNode.attributes().hostname) {
                    hostName = rootNode.attributes().hostname;
                }

                //assume runtimes from xl are current local time since timezone information is not in the xml. If xml date > current local date, fall back to local
                if(rootNode.attributes().timestamp) {
                    var timestampFromXml = rootNode.attributes().timestamp;
                    if(timestampFromXml < new Date()) {
                        timeStamp = timestampFromXml;
                    }                    
                }

                if(rootNode.attributes().time) {
                    totalRunDuration = rootNode.attributes().time;
                }

                //find test case nodes in JUnit result xml
                var testResults = [];

                for(var i = 0; i < rootNode.testcase.count(); i ++) {
                    var testCaseNode = rootNode.testcase.at(i);

                    //testcase name and type
                    var testName = "";
                    if(testCaseNode.attributes().name) {
                        testName = testCaseNode.attributes().name;                    
                    } 

                    var testStorage = "";
                    if(testCaseNode.attributes().classname) {
                        testStorage = testCaseNode.attributes().classname;
                    }

                    //testcase duration
                    var testCaseDuration = 0; //in seconds
                    if(testCaseNode.attributes().time) {
                        testCaseDuration = testCaseNode.attributes().time;
                        totalTestCaseDuration = totalTestCaseDuration + testCaseDuration;
                    }
                    
                    //testcase outcome
                    var outcome = "Passed";
                    var errorMessage = "";
                    if(testCaseNode.failure) {
                        outcome = "Failed";
                        errorMessage = testCaseNode.failure.text();
                    }
                    else if(testCaseNode.error) {
                        outcome = "Failed";
                        errorMessage = testCaseNode.error.text();
                    }

                    var testResult : ifm.TestRunResult = <ifm.TestRunResult> {
                        state: "Completed",
                        computerName: hostName,
                        resolutionState: null,
                        testCasePriority: 1,
                        failureType: null,
                        automatedTestName: testName,
                        automatedTestStorage: testStorage,
                        automatedTestType: "JUnit",
                        automatedTestTypeId: null,
                        automatedTestId: null,
                        area: null,
                        owner: buildRequestedFor, 
                        runBy: buildRequestedFor,
                        testCaseTitle: testName,
                        revision: 0,
                        dataRowCount: 0,
                        testCaseRevision: 0,
                        outcome: outcome,
                        errorMessage: errorMessage,
                        durationInMs: totalTestCaseDuration * 1000, //convert to milliseconds
                    };
                    
                    testResults.push(testResult);
                }

                if(totalRunDuration < totalTestCaseDuration) {
                    totalRunDuration = totalTestCaseDuration; //run duration may not be set in the xml, so use the testcase duration
                }
            }    

            var completedDate = timeStamp;
            completedDate.setSeconds(timeStamp.getSeconds() + totalRunDuration);
            
            //create test run data
            var testRun: ifm.TestRun = <ifm.TestRun>    {
                name: runName,
                iteration: "",
                state: "InProgress",
                automated: true,
                errorMessage: "",
                type: "",
                controller: "",
                buildDropLocation: "",
                buildPlatform: platform,
                buildFlavor: config,
                comment: "",
                testEnvironmentId: "",
                startDate: timeStamp,
                //completeDate: completedDate,
                releaseUri: "",
                build: { id: buildId}
            };

            testRun2 = <ifm.TestRun2>{
                testRun : testRun,
                testResults: testResults
            };
        });
        
        return testRun2;
    }
}
