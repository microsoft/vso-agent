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
        var resultFilePath: string = this.command.message;
        
        var resultType: string = this.command.properties['type'];
        if(resultType) { 
            resultType = resultType.toLowerCase(); 
        }

        var platform: string = this.command.properties['platform'];
        var config : string = this.command.properties['config'];
        var command = this.command;
        
        var testRunContext: trp.TestRunContext = {
            requestedFor: this.executionContext.variables["build.requestedFor"],
            buildId: this.executionContext.variables["build.buildId"],
            releaseEnvironmentUri: this.executionContext.variables["release.environmentUri"],
            releaseUri: this.executionContext.variables["release.releaseUri"],
            platform: platform,
            config: config
        };

        var reader;
        if (resultType == "junit") {
            reader = new trr.JUnitResultReader();
        }
        else if (resultType == "nunit") {
            reader = new trr.NUnitResultReader();
        }
        else if (resultType == "xunit") {
            reader = new trr.XUnitResultReader();
        }
        else {
            this.command.warning("Test results of format '" + resultType + "'' are not supported by the VSO/TFS OSX and Linux build agent");
        }

        if (reader != null) {
            var testRunPublisher = new trp.TestRunPublisher(this.executionContext.service, command, teamProject, testRunContext, reader);

            testRunPublisher.publishTestRun(resultFilePath).then(function (createdTestRun) {
                defer.resolve(null);
            })
            .fail((err) => {
                this.command.warning("Failed to publish test results: " + err.message);
                defer.resolve(null);
            });
        }
        else {
            defer.resolve(null);
        }

        return defer.promise;
    }   
}

