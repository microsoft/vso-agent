import ifm = require('./api/interfaces');
import trp = require('./testrunpublisher');
import utilities = require('./utilities');

var fs = require('fs');
var path = require("path");
var xmlreader = require('xmlreader');
var Q = require('q');

export class JUnitResultReader implements trp.IResultReader {

    public readResults(file: string, runContext: trp.TestRunContext) : Q.Promise<ifm.TestRun2> {
        return new ResultReader("junit").readResults(file, runContext);
    }
          
}

//-----------------------------------------------------
// Read NUnit results from a file
// - file: string () - location of the NUnit results file 
//-----------------------------------------------------
export class NUnitResultReader implements trp.IResultReader {
    
    public readResults(file: string, runContext: trp.TestRunContext) : Q.Promise<ifm.TestRun2> {
        return  new ResultReader("nunit").readResults(file, runContext);
    }    

}

export class TestSuiteSummary {  
    name: string;
    host: string;
    timeStamp: Date;
    duration: number;
    results: ifm.TestRunResult[];

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

    public readResults(file: string, runContext: trp.TestRunContext) : Q.Promise<ifm.TestRun2> {
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

    private readTestRunData(contents: string, runContext: trp.TestRunContext) : Q.Promise<ifm.TestRun2> {
        var defer = Q.defer(); 
      
        var testRun2 : ifm.TestRun2;
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
        else {
            return null;
        }

    }    

    private parseJUnitXml(res, runContext) {
        var testRun2 : ifm.TestRun2;

        var buildId = runContext.buildId;
        var buildRequestedFor = runContext.requestedFor;
        var platform = runContext.platform;
        var config = runContext.config;

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
        var testRun: ifm.TestRun = <ifm.TestRun>    {
            name: runSummary.name,
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
            startDate: runSummary.timeStamp,
            completeDate: completedDate,
            releaseUri: "",
            build: { id: buildId }
        };

        testRun2 = <ifm.TestRun2>{
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
                computerName: testSuiteSummary.host,
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
                durationInMs: Math.round(testCaseDuration * 1000) //convert to milliseconds and round to nearest whole number since server can't handle decimals for test case duration
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
        var testRun2: ifm.TestRun2;
        
        var buildId = runContext.buildId;
        var buildRequestedFor = runContext.requestedFor;

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
            completeDate: completedDate,
            releaseUri: "",
            build: { id: buildId }
        };

        testRun2 = <ifm.TestRun2>{
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
                    durationInMs: Math.round(testCaseDuration * 1000), //convert to milliseconds
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
}



