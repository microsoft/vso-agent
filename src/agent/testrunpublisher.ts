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
var archiver = require('archiver');
var shell = require("shelljs");

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

        this.reader.readResults(file, this.runContext).then(function(testRun) {
            defer.resolve(testRun);
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    //-----------------------------------------------------
    // Start a test run - create a test run entity on the server, and marks it in progress
    // - testRun: TestRun - test run to be published  
    // - resultsFilePath - needed for uploading the run level attachment 
    //-----------------------------------------------------
    public startTestRun(testRun: testifm.RunCreateModel): Q.Promise<testifm.TestRun> {
        var defer = Q.defer();

        var _this = this;

        _this.service.createTestRun(testRun).then(function(createdTestRun) {
            defer.resolve(createdTestRun);
        }, function(err) {
            defer.reject(err);
        });
        return defer.promise;
    }

    //-----------------------------------------------------
    // Stop a test run - mark it completed
    // - testRun: TestRun - test run to be published  
    //-----------------------------------------------------
    public endTestRun(testRunId: number, resultFilePath: string, publishArchive?: boolean): Q.Promise<testifm.TestRun> {
        var defer = Q.defer();
        var _this = this;
        this.service.endTestRun(testRunId).then(function(endedTestRun) {
            // Uploading run level attachments, only after run is marked completed;
            // so as to make sure that any server jobs that acts on the uploaded data (like CoverAn job does for Coverage files)  
            // have a fully published test run results, in case it wants to iterate over results 
            if (_this.runContext.publishRunAttachments === true) {
                if (publishArchive) {
                    var filesToArchive = resultFilePath.split(",");
                    utilities.archiveFiles(filesToArchive, "TestResults_" + _this.runContext.buildId + ".zip").then(function(zipFile) {
                        _this.publishTestRunFiles(testRunId, zipFile).then(function(res) {
                            defer.resolve(endedTestRun);
                        }).fail(function(err) {
                            defer.resolve(endedTestRun);
                        })
                        shell.rm('-rf', zipFile);
                    });
                } else {
                    _this.publishTestRunFiles(testRunId, resultFilePath).then(function(res) {
                        defer.resolve(endedTestRun);
                    }).fail(function(err) {
                        defer.resolve(endedTestRun);
                    })
                }
            }
            else {
                defer.resolve(endedTestRun);
            }
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    //-----------------------------------------------------
    // Stop a test run - mark it completed
    // - testRunId: number - test run id to be published
    // - resultFile: string - test run file name
    //-----------------------------------------------------
    public publishTestRunFiles(testRunId: number, resultFile: string): Q.Promise<any> {
        var defer = Q.defer();
        var _this = this;

        utilities.readFileContents(resultFile, "utf8").then(function(res) {
            var contents = new Buffer(res).toString('base64');
            _this.service.createTestRunAttachment(testRunId, path.basename(resultFile), contents).then(
                function(attachment) {
                    defer.resolve(attachment);
                },
                function(err) {
                    // We can skip attachment publishing if it fails to upload
                    if (_this.command) {
                        _this.command.warning("Skipping attachment : " + resultFile + ". " + err.statusCode + " - " + err.message);
                    }

                    defer.resolve(null);
                });
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    //-----------------------------------------------------
    // Add results to an inprogress test run 
    // - testrunID: number - runId against which results are to be published 
    // - testRunResults: TestRunResult[] - testresults to be published  
    //-----------------------------------------------------
    public addResults(testRunId: number, testResults: testifm.TestResultCreateModel[]): Q.Promise<testifm.TestCaseResult[]> {
        var defer = Q.defer();
        var _this = this;

        var i = 0;
        var batchSize = 100;
        var returnedResults;
        async.whilst(
            function() {
                return i < testResults.length;
            },
            function(callback) {
                var noOfResultsToBePublished = batchSize;
                if (i + batchSize >= testResults.length) {
                    noOfResultsToBePublished = testResults.length - i;
                }
                var currentBatch = testResults.slice(i, i + noOfResultsToBePublished);
                i = i + batchSize;

                var _callback = callback;
                _this.service.createTestRunResult(testRunId, currentBatch).then(function(createdTestResults) {
                    returnedResults = createdTestResults;
                    setTimeout(_callback, 10);
                },
                    function(err) {
                        defer.reject(err);
                    });
            },
            function(err) {
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
        var testRunId: number;
        var results;

        _this.readResults(resultFilePath).then(function(res) {
            results = res.testResults;
            return _this.startTestRun(res.testRun);
        }).then(function(res) {
            testRunId = res.id;
            return _this.addResults(testRunId, results);
        }).then(function(res) {
            return _this.endTestRun(testRunId, resultFilePath);
        }).then(function(res) {
            defer.resolve(res);
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    //-----------------------------------------------------
    // Publish a test run
    // - resultFiles: string - Path to the results files
    //-----------------------------------------------------
    public publishMergedTestRun(resultFiles: string[]): Q.Promise<testifm.TestRun> {
        var defer = Q.defer();

        var _this = this;
        var testRunId: number;
        var totalTestCaseDuration: number = 0;
        var totalTestResults: testifm.TestResultCreateModel[] = [];

        _this.readTestReports(resultFiles).then(function(res) {
            totalTestResults = totalTestResults.concat(res.totalTestResults);
            totalTestCaseDuration += res.totalTestCaseDuration;

            var currentTime = Date.now();
            var startDate = new Date(currentTime);
            var completedDate = new Date(currentTime + totalTestCaseDuration);

            //create test run data
            var testRun = <testifm.RunCreateModel>{
                name: _this.runContext.runTitle,
                startDate: startDate.toISOString(),
                completeDate: completedDate.toISOString(),
                state: "InProgress",
                automated: true,
                buildPlatform: _this.runContext.platform,
                buildFlavor: _this.runContext.config,
                build: { id: _this.runContext.buildId },
                releaseUri: _this.runContext.releaseUri,
                releaseEnvironmentUri: _this.runContext.releaseEnvironmentUri
            };

            _this.startTestRun(testRun).then(function(res) {
                testRunId = res.id;
                return _this.addResults(testRunId, totalTestResults);
            }).then(function(res) {
                return _this.endTestRun(testRunId, resultFiles.join(","), true);
            }).then(function(res) {
                defer.resolve(testRun);
            }).fail(function(err) {
                defer.reject(err);
            });
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    public readTestReports(resultFiles: string[]): Q.Promise<testifm.TestRunDetails> {
        var _this = this;
        var defer = Q.defer();
        var totalTestCaseDuration: number = 0;
        var totalTestResults: testifm.TestResultCreateModel[] = [];
        var j = 0;

        if (resultFiles.length == 0) {
            defer.resolve(null);
        }

        for (var i = 0; i < resultFiles.length; i++) {
            var report = _this.readResults(resultFiles[i]).then(function(res) {
                res.testResults.forEach(tr => {
                    totalTestCaseDuration += +tr.durationInMs;
                });
                totalTestResults = totalTestResults.concat(res.testResults);

                //This little hack make sures that we are returning once reading of all files is completed in async.
                j++;
                if (j == resultFiles.length) {
                    var testRunDetails = <testifm.TestRunDetails>{
                        totalTestResults: totalTestResults,
                        totalTestCaseDuration: totalTestCaseDuration
                    };
                    defer.resolve(testRunDetails);
                    return defer.promise;
                }
            });
        }

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
    runTitle: string;
    publishRunAttachments: boolean;
    fileNumber: string;
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