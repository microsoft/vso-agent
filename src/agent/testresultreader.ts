import ifm = require('./interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import trp = require('./testrunpublisher');
import utilities = require('./utilities');

var fs = require('fs');
var path = require("path");
var xmlreader = require('xmlreader');
var Q = require('q');

export class JUnitResultReader implements trp.IResultReader {

    public readResults(file: string, runContext: trp.TestRunContext) : Q.Promise<ifm.TestRunWithResults> {
        return new ResultReader("junit").readResults(file, runContext);
    }
          
}

//-----------------------------------------------------
// Read NUnit results from a file
// - file: string () - location of the NUnit results file 
//-----------------------------------------------------
export class NUnitResultReader implements trp.IResultReader {
    
    public readResults(file: string, runContext: trp.TestRunContext) : Q.Promise<ifm.TestRunWithResults> {
        return  new ResultReader("nunit").readResults(file, runContext);
    }    

}

export class XUnitResultReader implements trp.IResultReader {

    public readResults(file: string, runContext: trp.TestRunContext): Q.Promise<ifm.TestRunWithResults> {
        return new ResultReader("xunit").readResults(file, runContext);
    }

}

export class TestSuiteSummary {  
    name: string;
    host: string;
    timeStamp: Date;
    duration: number;
    results: testifm.TestResultCreateModel[];

    constructor() {
        this.name = "JUnit";
        this.host = "";
        this.timeStamp = new Date();
        this.duration = 0;
        this.results = [];
    }
    
    addResults(res) {
        this.results = this.results.concat(res);
    }
}

export class ResultReader {

    private type: string;
    constructor(readerType: string) {
        this.type = readerType;
    }

    public readResults(file: string, runContext: trp.TestRunContext) : Q.Promise<ifm.TestRunWithResults> {
        var defer = Q.defer(); 
        var _this = this;

        utilities.readFileContents(file, "utf-8").then(function (contents) {
            var xmlContents = contents.replace("\ufeff", ""); //replace BOM if exists to avoid xml read error
            return _this.readTestRunData(xmlContents, runContext);
        }).then(function (testRun) {
            defer.resolve(testRun);
        }).fail(function (err) {
            defer.reject(err);
        });        

        return defer.promise;
    }

    private readTestRunData(contents: string, runContext: trp.TestRunContext) : Q.Promise<ifm.TestRunWithResults> {
        var defer = Q.defer(); 
      
        var testRun2 : ifm.TestRunWithResults;
        var _this = this;

        xmlreader.read(contents, function (err, res) {
            if(err) {
                defer.reject(err);
            } 
            else {
                try {
                    testRun2 = _this.parseXml(res, runContext);
                    defer.resolve(testRun2);
                }
                catch(ex) {
                    defer.reject(ex);
                }
            }
        });

        return defer.promise;
    }

    private parseXml(res, runContext) {
        if(this.type == "junit") {
            return this.parseJUnitXml(res, runContext);
        }
        else if(this.type == "nunit") {
            return this.parseNUnitXml(res, runContext);
        }
        else if (this.type == "xunit") {
            return this.parseXUnitXml(res, runContext);
        }
        else {
            return null;
        }

    }    

    private parseJUnitXml(res, runContext) {
        var testRun2 : ifm.TestRunWithResults;

        var buildId = runContext.buildId;
        var buildRequestedFor = runContext.requestedFor;
        var platform = runContext.platform;
        var config = runContext.config;
        var releaseUri = runContext.releaseUri;
        var releaseEnvironmentUri = runContext.releaseEnvironmentUri;

        //init test run summary - runname, host, start time, run duration
        var runSummary = new TestSuiteSummary();
        
        if(res.testsuites) {
            var testSuitesNode = res.testsuites.at(0);
        }

        if(testSuitesNode) {
            if(testSuitesNode.testsuite) {
                var numTestSuites = testSuitesNode.testsuite.count();
                for(var n = 0; n < numTestSuites; n ++) {
                    var testSuiteSummary = this.readTestSuiteJUnitXml(testSuitesNode.testsuite.at(n), buildRequestedFor);
                    runSummary.duration += testSuiteSummary.duration;
                    runSummary.addResults(testSuiteSummary.results);
                    runSummary.host = testSuiteSummary.host;
                    runSummary.name = testSuiteSummary.name;
                    if(runSummary.timeStamp > testSuiteSummary.timeStamp) {
                        runSummary.timeStamp = testSuiteSummary.timeStamp; //use earlier Date for run start time
                    }
                }
                if(numTestSuites > 1) {
                    runSummary.name = "JUnit";
                }
            }
        }
        else {
            if(res.testsuite) {
                var testSuiteNode = res.testsuite.at(0);
            }
            if(testSuiteNode) {
                runSummary = this.readTestSuiteJUnitXml(testSuiteNode, buildRequestedFor);
            }
        }            

        var completedDate = runSummary.timeStamp;
        completedDate.setSeconds(runSummary.timeStamp.getSeconds() + runSummary.duration);

        //create test run data
        var testRun =    <testifm.RunCreateModel>{
            name: runSummary.name,
            state: "InProgress",
            automated: true,
            buildPlatform: platform,
            buildFlavor: config,
            startDate: runSummary.timeStamp.toISOString(),
            completeDate: completedDate.toISOString(),
            build: { id: buildId },
            releaseUri: releaseUri,
            releaseEnvironmentUri: releaseEnvironmentUri
        };

        testRun2 = <ifm.TestRunWithResults>{
            testRun: testRun,
            testResults: runSummary.results,
        };         

        return testRun2;
    }

    private readTestSuiteJUnitXml(rootNode, buildRequestedFor) {
        var testSuiteSummary = new TestSuiteSummary();
        var totalRunDuration = 0;
        var totalTestCaseDuration = 0;

        if(rootNode.attributes().name) {
            testSuiteSummary.name = rootNode.attributes().name;
        }

        if(rootNode.attributes().hostname) {
            testSuiteSummary.host = rootNode.attributes().hostname;
        }

        //assume runtimes from xml are current local time since timezone information is not in the xml. If xml date > current local date, fall back to local
        if(rootNode.attributes().timestamp) {
            var timestampFromXml = new Date(rootNode.attributes().timestamp);
            if(timestampFromXml < new Date()) {
                testSuiteSummary.timeStamp = timestampFromXml;
            }                    
        }

        if(rootNode.attributes().time) {
            totalRunDuration = parseFloat(rootNode.attributes().time); //in seconds
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
                testCaseDuration = parseFloat(testCaseNode.attributes().time);
                totalTestCaseDuration += testCaseDuration;
            }
            
            //testcase outcome
            var outcome = "Passed";
            var errorMessage = "";
            var stackTrace = "";
            if(testCaseNode.failure) {
                outcome = "Failed";
                if (testCaseNode.failure.text) {
                    stackTrace = testCaseNode.failure.text();
                }
                if (testCaseNode.failure.attributes().message) {
                    errorMessage = testCaseNode.failure.attributes().message;
                }
            }
            else if(testCaseNode.error) {
                outcome = "Failed";
                if (testCaseNode.error.text) {
                    stackTrace = testCaseNode.error.text();
                }
                if (testCaseNode.error.attributes().message) {
                    errorMessage = testCaseNode.error.attributes().message;
                }
            }
            else if (testCaseNode.skipped) {
                outcome = "NotExecuted";
                errorMessage = testCaseNode.skipped.text();
            }

            var testResult : testifm.TestResultCreateModel = <testifm.TestResultCreateModel> {
                state: "Completed",
                computerName: testSuiteSummary.host,
                testCasePriority: "1",
                automatedTestName: testName,
                automatedTestStorage: testStorage,
                automatedTestType: "JUnit",
                owner: { id: buildRequestedFor }, 
                runBy: { id: buildRequestedFor },
                testCaseTitle: testName,
                outcome: outcome,
                errorMessage: errorMessage,
                durationInMs: "" + Math.round(testCaseDuration * 1000), //convert to milliseconds and round to nearest whole number since server can't handle decimals for test case duration
                stackTrace: stackTrace
            };
                
            testResults.push(testResult);
        }    

        if(totalRunDuration < totalTestCaseDuration) {
            totalRunDuration = totalTestCaseDuration; //run duration may not be set in the xml, so use the testcase duration
        }
        testSuiteSummary.duration = totalRunDuration;
        testSuiteSummary.addResults(testResults);

        return testSuiteSummary;
    }

    private parseNUnitXml(res, runContext) {
        var testRun2: ifm.TestRunWithResults;
        
        var buildId = runContext.buildId;
        var buildRequestedFor = runContext.requestedFor;
        var releaseUri = runContext.releaseUri;
        var releaseEnvironmentUri = runContext.releaseEnvironmentUri;

        //read test run summary - runname, host, start time, run duration
        var runName = "NUnit";
        var runStartTime = new Date(); 
        var totalRunDuration = 0;

        var rootNode = res["test-results"].at(0);
        if(rootNode) {
                
            if(rootNode.attributes().name) {
                runName = rootNode.attributes().name;
            }

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
        var platform = runContext.platform;
        var config = runContext.config;
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
            testResults = testResults.concat(this.FindNUnitTestCaseNodes(rootNode["test-suite"].at(t), hostName, buildRequestedFor, rootNode.attributes().name));

            if(rootNode["test-suite"].at(t).attributes().time) {
                totalRunDuration += parseFloat(rootNode["test-suite"].at(t).attributes().time);
            }
        }

        var completedDate = runStartTime;
        completedDate.setSeconds(runStartTime.getSeconds() + totalRunDuration);

        //create test run data
        var testRun: testifm.RunCreateModel = <testifm.RunCreateModel>    {
            name: runName,
            state: "InProgress",
            automated: true,
            buildPlatform: platform,
            buildFlavor: config,
            startDate: runStartTime.toISOString(),
            completeDate: completedDate.toISOString(),
            build: { id: buildId },
            releaseUri: releaseUri,
            releaseEnvironmentUri: releaseEnvironmentUri
        };

        testRun2 = <ifm.TestRunWithResults>{
            testRun: testRun,
            testResults: testResults,
        };         

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
                    testCaseDuration = parseFloat(testCaseNode.attributes().time);
                }                            

                //testcase outcome
                var outcome = "Passed";
                var errorMessage = "";
                var stackTrace = "";
                if(testCaseNode.failure) {
                    outcome = "Failed";
                    if(testCaseNode.failure.message && testCaseNode.failure.message.text) {
                        errorMessage = testCaseNode.failure.message.text();
                    }
                    if(testCaseNode.failure["stack-trace"] && testCaseNode.failure["stack-trace"].text) {
                        stackTrace = testCaseNode.failure["stack-trace"].text();
                    }
                }      
                
                var testResult : testifm.TestResultCreateModel = <testifm.TestResultCreateModel> {
                    state: "Completed",
                    computerName: hostName,
                    testCasePriority: "1",
                    automatedTestName: testName,
                    automatedTestStorage: testStorage,
                    automatedTestType: "NUnit",
                    owner: { id: buildRequestedFor },
                    runBy: { id: buildRequestedFor },
                    testCaseTitle: testName,
                    outcome: outcome,
                    errorMessage: errorMessage,
                    durationInMs: "" + Math.round(testCaseDuration * 1000), //convert to milliseconds
                    stackTrace: stackTrace
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

    private parseXUnitXml(res, runContext) {
        var testRun2: ifm.TestRunWithResults;

        var buildId, buildRequestedFor, platform, config;

        if (runContext) {
            //Build ID, run user.
            buildId = runContext.buildId;
            buildRequestedFor = runContext.requestedFor;              

            //Run environment - platform, config, host name.
            platform = runContext.platform;
            config = runContext.config;

            //Release uri, Release environment uri
            var releaseUri = runContext.releaseUri;
            var releaseEnvironmentUri = runContext.releaseEnvironmentUri;
        }

        var runName = "XUnit Test Run";
        var runStartTime = new Date();
        var totalRunDuration = 0;
        var hostName = "";

        var rootNode = res["assemblies"].at(0);
        var testResults = [];

        //Get all test cases.
        for (var t = 0; t < rootNode["assembly"].count(); t++) {
            var assemblyNode = rootNode["assembly"].at(t);
            testResults = testResults.concat(this.FindXUnitTestCaseNodes(assemblyNode, hostName, buildRequestedFor, assemblyNode.attributes().name));
            if (assemblyNode["collection"] && assemblyNode["collection"].attributes().time) {
                totalRunDuration += parseFloat(assemblyNode["collection"].attributes().time);
            }
        }

        var completedDate = runStartTime;
        completedDate.setSeconds(runStartTime.getSeconds() + totalRunDuration);

        //create test run data.
        var testRun = {
            name: runName,
            state: "InProgress",
            automated: true,
            buildPlatform: platform,
            buildFlavor: config,
            startDate: runStartTime,
            completeDate: completedDate,
            build: <testifm.ShallowReference>{ id: buildId },
            releaseUri: releaseUri,
            releaseEnvironmentUri: releaseEnvironmentUri
        };

        testRun2 = <ifm.TestRunWithResults>{
            testRun: <testifm.RunCreateModel><any>testRun,
            testResults: testResults,
        };

        return testRun2;
    }

    private FindXUnitTestCaseNodes(startNode, hostName: string, buildRequestedFor: string, assemblyName: string) {

        var foundTestResults = [];
        var testStorage = assemblyName;
        
        //If test node(s) exist, read test case information.
        if (startNode.collection["test"]) {

            for (var i = 0; i < startNode.collection["test"].count(); i++) {
                var testNode = startNode.collection["test"].at(i);
                
                //Testcase name.
                var testName = "";
                if (testNode.attributes().name) {
                    testName = testNode.attributes().name;
                }                                                               

                //Fully qualified test name.
                var fullTestName = "";
                if (testNode.attributes().method) {
                    fullTestName = testNode.attributes().method;
                } 

                //Testcase duration in seconds.
                var testCaseDuration = 0;
                if (testNode.attributes().time) {
                    testCaseDuration = parseFloat(testNode.attributes().time);
                }                            

                //Testcase outcome, error message, stack trace.
                var outcome = "Passed";
                var errorMessage = "";
                var stackTrace = "";
                if (testNode.failure) {
                    outcome = "Failed";
                    if (testNode.failure.message && testNode.failure.message.text) {
                        errorMessage = testNode.failure.message.text();
                    }
                    if (testNode.failure["stack-trace"] && testNode.failure["stack-trace"].text) {
                        stackTrace = testNode.failure["stack-trace"].text();
                    }
                }
                else if (testNode.attributes().result && testNode.attributes().result == "Skip") {
                    outcome = "NotExecuted";
                }
                
                //Priority and owner traits.
                var priority;
                var owner;
                if (testNode.traits) {
                    for (var i = 0; i < testNode.traits["trait"].count(); i++) {
                        var traitNode = testNode.traits["trait"].at(i);
                        if (traitNode.attributes().name == "priority") {
                            priority = traitNode.attributes().value;
                        }
                        if (traitNode.attributes().name == "owner") {
                            owner = traitNode.attributes().value;
                        }
                    }
                }

                var testResult = {
                    state: "Completed",
                    computerName: hostName,
                    testCasePriority: priority,
                    automatedTestName: fullTestName,
                    automatedTestStorage: testStorage,
                    owner: owner,
                    runBy: buildRequestedFor,
                    testCaseTitle: testName,
                    revision: 0,
                    outcome: outcome,
                    errorMessage: errorMessage,
                    durationInMs: Math.round(testCaseDuration * 1000), //Convert to milliseconds.
                    stackTrace: stackTrace
                };

                foundTestResults.push(testResult);
            }
        }

        return foundTestResults;
    }
}



