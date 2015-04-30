import ifm = require('./api/interfaces');
import webapi = require('./api/webapi');
import ctxm = require('./context');

var async = require('async');
var fs = require('fs');
var path = require("path");
var xmlreader = require('xmlreader');
var Q = require('q');

export class TestRunPublisher {
    constructor(taskCtx: ctxm.TaskContext) {
        this.taskCtx = taskCtx;

        var tfsCollectionUrl = this.taskCtx.variables["system.teamFoundationCollectionUri"];
        var teamProject = this.taskCtx.variables["system.teamProject"];

        this.testApi = webapi.QTestManagementApi(tfsCollectionUrl + "/" + teamProject, this.taskCtx.authHandler);
    }

    private testApi: ifm.IQTestManagementApi;
    private taskCtx: ctxm.TaskContext;

    public ReadResultsFromFile(file: string, type: string) {
        var allTestRuns;

        console.log("Reading test results of format: " + type + " , from file: " + file);

        if (type == "junit") {
            allTestRuns = this.ReadJUnitResults(file);
        }
        else if (type == "nunit") {
            allTestRuns = this.ReadNUnitResults(file);
        }
        else {
            console.log("Test results of format '" + type + "'' are not supported by the VSO/TFS OSX and Linux build agent");
        }

        return allTestRuns;
    }

    //-----------------------------------------------------
    // Read JUnit results from a file
    // - file: string () - location of the JUnit results file 
    //-----------------------------------------------------
    private ReadJUnitResults(file: string) {
        
        var testRun2 : ifm.TestRun2;
        var contents = fs.readFileSync(file, "utf-8");
        contents = contents.replace("\ufeff", ""); //replace BOM if exits to avoid xml read error
      
        var buildId = this.taskCtx.variables["build.buildId"];
        var buildRequestedFor = this.taskCtx.variables["build.requestedFor"];
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
                    var timestampFromXml = new Date(rootNode.attributes().timestamp);
                    if(timestampFromXml < new Date()) {
                        timeStamp = timestampFromXml;
                    }                    
                }

                if(rootNode.attributes().time) {
                    totalRunDuration = rootNode.attributes().time; //in seconds
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
                        durationInMs: testCaseDuration * 1000, //convert to milliseconds
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

    //-----------------------------------------------------
    // Read NUnit results from a file
    // - file: string () - location of the NUnit results file 
    //-----------------------------------------------------
    private ReadNUnitResults(file: string) {
        var testRun2: ifm.TestRun2;
        var buildId = this.taskCtx.variables["build.buildId"];
        var buildRequestedFor = this.taskCtx.variables["build.requestedFor"];

        var contents = fs.readFileSync(file, "utf-8");
        contents = contents.replace("\ufeff", ""); //replace BOM if exits to avoid xml read error

        var that = this;

        xmlreader.read(contents, function (err, res){

            if(err) return console.log(err);
            
            //read test run summary - runname, host, start time, run duration
            var runName = "NUnit";
            var runStartTime = new Date(); 
            var totalRunDuration = 0;
        
            var rootNode = res["test-results"].at(0);
            if(rootNode) {
                
                if(rootNode.attributes().name) {
                    runName = rootNode.attributes().name;
                }

                //runtimes
                var dateFromXml = new Date();
                if(rootNode.attributes().date) {
                    dateFromXml = rootNode.attributes().date;                                        
                }

                var timeFromXml = "00:00:00";
                if(rootNode.attributes().time) {
                    timeFromXml = rootNode.attributes().time;
                }
                
                var dateTimeFromXml = new Date(dateFromXml + "T" + timeFromXml);
                if (dateTimeFromXml < new Date()) {
                    runStartTime = dateTimeFromXml;
                }                
            }

            //run environment - platform, config, hostname
            var platform = "";
            var config = "";
            var runUser = "";
            var hostName = "";
        
            if(rootNode.environment) { var envNode = rootNode.environment.at(0); }

            if(envNode) {
                
                if(envNode.attributes()["machine-name"]) {
                    hostName = envNode.attributes()["machine-name"];
                }

                if(envNode.attributes().platform) {
                    platform = envNode.attributes().platform;
                }
            }            

            //get all test cases
            var testResults = [];
            
            for(var t = 0; t < rootNode["test-suite"].count(); t ++) { 
                testResults = testResults.concat(that.FindNUnitTestCaseNodes(rootNode["test-suite"].at(t), hostName, buildRequestedFor, rootNode.attributes().name));

                if(rootNode["test-suite"].at(t).attributes().time) {
                    totalRunDuration += rootNode["test-suite"].at(t).attributes().time;
                }
            }

            var completedDate = runStartTime;
            completedDate.setSeconds(runStartTime.getSeconds() + totalRunDuration);

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
                startDate: runStartTime,
                //completeDate: completedDate,
                releaseUri: "",
                build: { id: buildId }
            };

            testRun2 = <ifm.TestRun2>{
                testRun: testRun,
                testResults: testResults,
            };         
        });
        
        return testRun2;
    }    

    private FindNUnitTestCaseNodes(startNode, hostName : string, buildRequestedFor : string, assemblyName : string) {
        
        var foundTestResults = [];
        
        var testStorage = assemblyName;
        if(startNode.attributes().type == "Assembly") {
            testStorage = startNode.attributes().name;
        }

        //if test-case node exist, read test case information
        if(startNode.results["test-case"]) {
            
            for(var i = 0; i < startNode.results["test-case"].count(); i ++) {
                var testCaseNode = startNode.results["test-case"].at(i);
                
                //testcase name and type
                var testName = "";
                if(testCaseNode.attributes().name) {
                    testName = testCaseNode.attributes().name;
                }                                                               

                //testcase duration
                var testCaseDuration = 0; //in seconds
                if(testCaseNode.attributes().time) {
                    testCaseDuration = testCaseNode.attributes().time;
                }                            

                //testcase outcome
                var outcome = "Passed";
                var errorMessage = "";
                if(testCaseNode.failure) {
                    outcome = "Failed";
                    if(testCaseNode.failure.message) {
                        errorMessage = testCaseNode.failure.message.text();
                    }
                }       
                            
                var testResult : ifm.TestRunResult = <ifm.TestRunResult> {
                    state: "Completed",
                    computerName: hostName,
                    resolutionState: null,
                    testCasePriority: 1,
                    failureType: null,
                    automatedTestName: testName,
                    automatedTestStorage: testStorage,
                    automatedTestType: "NUnit",
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
                    durationInMs: testCaseDuration * 1000, //convert to milliseconds
                };

                foundTestResults.push(testResult);
            }            
        }   

        if(startNode.results["test-suite"]) {
            for(var j = 0; j < startNode.results["test-suite"].count(); j++) {
                foundTestResults = foundTestResults.concat(this.FindNUnitTestCaseNodes(startNode.results["test-suite"].at(j), hostName, buildRequestedFor, testStorage));
            }
        }                      
        
        return foundTestResults;
    }

    //-----------------------------------------------------
    // Start a test run - create a test run entity on the server, and mark it in progress
    // - testRun: TestRun - test run to be published  
    //-----------------------------------------------------
    public StartTestRun(testRun: ifm.TestRun, resultFilePath: string) {
        var api = this.testApi;
        
        return this.testApi.createTestRun(testRun).then(function (createdTestRun) {
            var contents = fs.readFileSync(resultFilePath, "ascii");
            contents = new Buffer(contents).toString('base64');

            api.createTestRunAttachment(createdTestRun.id, path.basename(resultFilePath), contents).then(function (attachment) {
                // TODO
            });
            return createdTestRun; 
        });
    }

    //-----------------------------------------------------
    // Stop a test run - mark it completed
    // - testRun: TestRun - test run to be published  
    //-----------------------------------------------------
    public EndTestRun(testRunId: number) {
        return this.testApi.endTestRun(testRunId).then(function (endedTestRun) {
            return endedTestRun;
        });
    }

    //-----------------------------------------------------
    // Add results to an inprogress test run 
    // - testRunResults: TestRunResult[] - testresults to be published  
    //-----------------------------------------------------
    public AddResults(testRunId: number, testResults: ifm.TestRunResult[]) {
        var defer = Q.defer();
        var _this = this;

        var i = 0;
        var batchSize = 100; 
        var returnedResults;
        async.whilst(
            function () {
                return i < testResults.length; 
            },
            function (callback) {
                var noOfResultsToBePublished = batchSize; 
                if (i + batchSize >= testResults.length)
                {
                    noOfResultsToBePublished = testResults.length - i;
                }
                var currentBatch = testResults.slice(i, i + noOfResultsToBePublished);
                i = i+ batchSize;

                var _callback = callback;
                _this.testApi.createTestRunResult(testRunId, currentBatch).then(function (createdTestResults)
                {
                    returnedResults = createdTestResults;
                    setTimeout(_callback, 1000);
                }); 
            },
            function (err) {
                defer.resolve(returnedResults); 
        });

        return defer.promise;
    } 
}


