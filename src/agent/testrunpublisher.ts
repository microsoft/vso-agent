import ifm = require('./interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import ctxm = require('./context');
import cm = require('./common');
import utilities = require('./utilities');

var async = require('async');
var fs = require('fs');
var path = require("path");
var xmlreader = require('xmlreader');
var Q = require('q');

export class TestRunPublisher {
    //-----------------------------------------------------
    // Constructs a TestRunPublisher instance 
    // - service: cm.IFeedbackChannel - for routing the server calls to real or loopback 
    // - command: cm.ITaskCommand - used for logging warnings, errors  
    // - teamProject: string - since test publishing is scoped to team projects 
    // - runContext: TestRunContext - for identifying context(buildId, platform, config, etc), which is needed while publishing
    // - reader: IResultReader - for reading different(junit, nunit) result files 
    //-----------------------------------------------------
    constructor(service: cm.IServiceChannel, command: cm.ITaskCommand, teamProject: string, runContext: TestRunContext, reader: IResultReader) {
        this.service = service;
        this.command = command;
        this.runContext = runContext;
        this.reader = reader;
        this.service.initializeTestManagement(teamProject);
    }

    // for routing the server calls to real or loopback 
    private service: cm.IServiceChannel;

    // used for logging warnings, errors  
    private command: cm.ITaskCommand;
    
    // for identifying context(buildId, platform, config, etc), which is needed while publishing 
    private runContext: TestRunContext;
    
    // for reading different(junit, nunit) result files 
    private reader: IResultReader;

    //-----------------------------------------------------
    // Read results from a file. Each file will be published as a separate test run
    // - file: string () - location of the results file 
    //-----------------------------------------------------    
    private readResults(file: string): Q.Promise<ifm.TestRunWithResults> {
        var defer = Q.defer();

        var testRun: ifm.TestRunWithResults;

        this.reader.readResults(file, this.runContext).then(function (testRun) {
            defer.resolve(testRun);
        }).fail(function (err) {
            defer.reject(err);
        });

        return defer.promise;
    }  

    //-----------------------------------------------------
    // Start a test run - create a test run entity on the server, and marks it in progress
    // - testRun: TestRun - test run to be published  
    // - resultsFilePath - needed for uploading the run level attachment 
    //-----------------------------------------------------
    public startTestRun(testRun: testifm.RunCreateModel, resultFilePath: string): Q.Promise<testifm.TestRun> {
        var defer = Q.defer();

        var _this = this;
        
        _this.service.createTestRun(testRun).then(function (createdTestRun) {
            utilities.readFileContents(resultFilePath, "ascii").then(function (res) {
                var contents = new Buffer(res).toString('base64');
                _this.service.createTestRunAttachment(createdTestRun.id, path.basename(resultFilePath), contents).then(
                    function (attachment) {
                        defer.resolve(createdTestRun);
                    },
                    function (err) {
                        // We can skip attachment publishing if it fails to upload
                        if (_this.command) {
                            _this.command.warning("Skipping attachment : " + resultFilePath + ". " + err.statusCode + " - " + err.message);
                        }

                        defer.resolve(createdTestRun);
                    });
            },
            function (err) {
                defer.reject(err);
            });        
        }, function (err) {
            defer.reject(err);  
        });
        return defer.promise;
     }

    //-----------------------------------------------------
    // Stop a test run - mark it completed
    // - testRun: TestRun - test run to be published  
    //-----------------------------------------------------
    public endTestRun(testRunId: number): Q.Promise<testifm.TestRun> {
        var defer = Q.defer();

        this.service.endTestRun(testRunId).then(function (endedTestRun) {
            defer.resolve(endedTestRun);
        },
        function (err) {
            defer.reject(err);  
        });
        return defer.promise;
    }

    //-----------------------------------------------------
    // Add results to an inprogress test run 
    // - testrunID: number - runId against which results are to be published 
    // - testRunResults: TestRunResult[] - testresults to be published  
    //-----------------------------------------------------
    public addResults(testRunId: number, testResults: testifm.TestResultCreateModel[]) : Q.Promise<testifm.TestCaseResult[]> {
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
                if (i + batchSize >= testResults.length) {
                    noOfResultsToBePublished = testResults.length - i;
                }
                var currentBatch = testResults.slice(i, i + noOfResultsToBePublished);
                i = i + batchSize;

                var _callback = callback;
                _this.service.createTestRunResult(testRunId, currentBatch).then(function (createdTestResults) {
                    returnedResults = createdTestResults;
                    setTimeout(_callback, 10);
                },
                function (err) {
                    defer.reject(err);
                }); 
            },
            function (err) {
                defer.resolve(returnedResults); 
        });

        return defer.promise;
    } 

    //-----------------------------------------------------
    // Publish a test run
    // - resultFilePath: string - Path to the results file
    //-----------------------------------------------------
    public publishTestRun(resultFilePath: string): Q.Promise<testifm.TestRun> {
        var defer = Q.defer();
        
        var _this = this;
        var testRunId;
        var results; 

        _this.readResults(resultFilePath).then(function (res) {
            results = res.testResults;
            return _this.startTestRun(res.testRun, resultFilePath);
        }).then(function (res) {
            testRunId = res.id;
            return _this.addResults(testRunId, results);
        }).then(function (res) {
            return _this.endTestRun(testRunId);
        }).then(function (res) {
            defer.resolve(res);
        }).fail(function (err) {
            defer.reject(err);
        }); 

        return defer.promise;
    }
}

//-----------------------------------------------------
// Will holds the test run context - buildId, platform, config, releaseuri, releaseEnvironmentUri used during publishing of test results   
//-----------------------------------------------------
export interface TestRunContext {
    requestedFor: string;
    buildId: string;
    platform: string;
    config: string;
    releaseUri: string;
    releaseEnvironmentUri: string;
};

//-----------------------------------------------------
// Interface to be implemented by all result readers 
//-----------------------------------------------------
export interface IResultReader {
    // Reads a test results file from disk  
    readResults(filePath: string, runContext: TestRunContext): Q.Promise<ifm.TestRunWithResults>; 
}