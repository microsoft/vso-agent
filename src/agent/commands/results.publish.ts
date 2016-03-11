import ctxm = require('../context');
import cm = require('../common');
import trp = require('../testrunpublisher');
import trr = require('../testresultreader');
import Q = require('q');

//-----------------------------------------------------
// Publishes results from a specified file to TFS server 
// - CMD_PREFIX + "results.publish type=junit]" + testResultsFile
//-----------------------------------------------------

export function createAsyncCommand(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
    return new ResultsPublishCommand(executionContext, command);
}

export class ResultsPublishCommand implements cm.IAsyncCommand {
    constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
        this.command = command;
        this.executionContext = executionContext;
        this.description = "Results.Publish async Command";
    }

    public command: cm.ITaskCommand;
    public executionContext: cm.IExecutionContext;
    public description: string;

    public runCommandAsync() {
        var defer = Q.defer();
        var teamProject = this.executionContext.variables["system.teamProject"];
        var resultType: string = this.command.properties['type'];
        if (resultType) {
            resultType = resultType.toLowerCase();
        }
        var platform: string = this.command.properties['platform'];
        var config: string = this.command.properties['config'];
        var runTitle: string = this.command.properties['runTitle'];
        var fileNumber: string = this.command.properties['fileNumber'];
        var publishRunAttachments: boolean = (this.command.properties['publishRunAttachments'] === "true");
        var resultFilesPath = this.command.properties['resultFiles'];
        var mergeResults: boolean = (this.command.properties['mergeResults'] === 'true');
        var command = this.command;

        var testRunContext: trp.TestRunContext = {
            requestedFor: this.executionContext.variables["build.requestedFor"],
            buildId: this.executionContext.variables["build.buildId"],
            releaseEnvironmentUri: this.executionContext.variables["release.environmentUri"],
            releaseUri: this.executionContext.variables["release.releaseUri"],
            platform: platform,
            config: config,
            runTitle: runTitle,
            //fileNumber: fileNumber,
            publishRunAttachments: publishRunAttachments
        };

        var reader;
        if (resultType == "junit") {
            reader = new trr.JUnitResultReader(this.command);
        }
        else if (resultType == "nunit") {
            reader = new trr.NUnitResultReader(this.command);
        }
        else if (resultType == "xunit") {
            reader = new trr.XUnitResultReader(this.command);
        }
        else if (resultType == "vstest") {
            this.command.warning("Test results of format '" + resultType + "'' are not supported on this build agent");
        }

        if (reader != null) {
            var testRunPublisher = new trp.TestRunPublisher(this.executionContext.service, command, teamProject, testRunContext, reader);
            var resultFiles = resultFilesPath.split(",");

            if (!mergeResults) {
                for (var i = 0; i < resultFiles.length; i++) {
                    testRunPublisher.publishTestRun(resultFiles[i]).then(function(createdTestRun) {
                        defer.resolve(null);
                    }).fail((err) => {
                        this.command.warning("Failed to publish test result for file" + resultFiles[i] + ": " + err.message);
                        defer.resolve(null);
                    });
                }
            } else {
                //Fix the run title if it's not given by user. 
                if (!runTitle) {
                    testRunContext.runTitle = resultType + "_TestResults_" + testRunContext.buildId;
                }
                testRunPublisher.publishMergedTestRun(resultFiles).then(function(createdTestRun) {
                    defer.resolve(null);
                }).fail((err) => {
                    this.command.warning("Failed to publish test result for file" + resultFilesPath + ": " + err.message);
                    defer.resolve(null);
                });
            }
        }
        else {
            defer.resolve(null);
        }

        return defer.promise;
    }
}