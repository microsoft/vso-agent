import ifm = require('./api/interfaces');
import webapi = require('./api/webapi');
import ctxm = require('./context');

var async = require('async');
var fs = require('fs');
var path = require("path");
var xmlreader = require('xmlreader');
var Q = require('q');

export class TestRunPublisher {
    constructor(tfsCollectionUrl: string, projectName: string, taskCtx: ctxm.TaskContext) {
        this.tfsCollectionUrl = tfsCollectionUrl;
        this.teamProject = projectName;
        this.taskCtx = taskCtx;
        this.testApi = webapi.QTestManagementApi(this.tfsCollectionUrl + "/" + this.teamProject, this.taskCtx.authHandler);
    }

    private testApi: ifm.IQTestManagementApi;
    private tfsCollectionUrl: string;
    private teamProject: string;
    private taskCtx: ctxm.TaskContext;

    public ReadResultsFromFile(file: string, type: string) {
        var allTestRuns;

        if (type == "junit") {
            allTestRuns = this.ReadJUnitResults(file);
        }

        return allTestRuns;
    }

    //-----------------------------------------------------
    // DUMMY JUNIT RESULTS READER 
    // Read junit results from a file. Each file will be published as a separate test run
    // - file: string () - location of the junit results file 
    //-----------------------------------------------------
    private ReadJUnitResults(file: string) {
        var testRun2: ifm.TestRun2;

        var contents = fs.readFileSync(file, "ascii");
        var buildId = this.taskCtx.variables["build.buildId"];

        xmlreader.read(contents, function (err, res){

            if(err) return console.log(err);
         
            var testRun: ifm.TestRun = <ifm.TestRun>    {
                name: res.testsuite.at(0).attributes().name,
                iteration: "",
                state: "InProgress",
                automated: true,
                errorMessage: "",
                type: "",
                controller: "",
                buildDropLocation: "",
                buildPlatform: "",
                buildFlavor: "",
                comment: "",
                testEnvironmentId: "",
                startDate: res.testsuite.at(0).attributes().timestamp,
                releaseUri: "",
                build: { id: buildId}
            };
            
            var testResults = [];

            for (var j = 0; j < res.testsuite.at(0).testcase.count(); j++)
            {
                var currentTestcase = res.testsuite.at(0).testcase.at(j);
                var failureMessage: string;
                var outcome: string = "Passed";
                if (currentTestcase.failure)
                {
                    failureMessage = currentTestcase.failure.text();
                    outcome = "Failed";
                }
                var testResult: ifm.TestRunResult = <ifm.TestRunResult>{
                    state: "Completed",
                    computerName: "",
                    resolutionState: null,
                    testCasePriority: 1,
                    failureType: null,
                    automatedTestName: null,
                    automatedTestStorage: null,
                    automatedTestType: null,
                    automatedTestTypeId: null,
                    automatedTestId: null,
                    area: null,
                    owner: "",
                    runBy: null,
                    testCaseTitle: currentTestcase.attributes().name,
                    revision: 0,
                    dataRowCount: 0,
                    testCaseRevision: 0,
                    outcome: outcome,
                    errorMessage: failureMessage,
                };
                testResults.push(testResult);
            }

            testRun2 = <ifm.TestRun2>{
                testRun: testRun,
                testResults: testResults
            };
        });
        return testRun2;
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


