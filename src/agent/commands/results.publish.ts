import ctxm = require('../context');
import cm = require('../common');
import trp = require('../testrunpublisher');
import trr = require('../testresultreader');

var Q = require('q');
var xmlreader = require('xmlreader');

//-----------------------------------------------------
// Publishes results from a specified file to TFS server 
// - CMD_PREFIX + "results.publish type=junit]" + testResultsFile
//-----------------------------------------------------

export function createAsyncCommand(taskCtx: ctxm.TaskContext, command: cm.ITaskCommand) {
    return new ResultsPublishCommand(taskCtx, command);
}

export class ResultsPublishCommand implements cm.IAsyncCommand {
    constructor(taskCtx: ctxm.TaskContext, command: cm.ITaskCommand) {
        this.command = command;
        this.taskCtx = taskCtx;
        this.description = "Results.Publish async Command";
    }

    public command: cm.ITaskCommand;
    public taskCtx: ctxm.TaskContext;
    public description: string;

    public runCommandAsync() {
        var defer = Q.defer();

        var teamProject = this.taskCtx.variables["system.teamProject"];
        var resultFilePath: string = this.command.message;
        var resultType: string = this.command.properties['type'].toLowerCase();
        var command = this.command;
        
        var testRunContext: trp.TestRunContext = {
            requestedFor: this.taskCtx.variables["build.requestedFor"],
            buildId: this.taskCtx.variables["build.buildId"],
            platform: "",
            config: ""
        };

        var reader;
        if (resultType == "junit") {
            reader = new trr.JUnitResultReader();
        }
        else if (resultType == "nunit") {
            reader = new trr.NUnitResultReader();
        }
        else {
            this.command.warning("Test results of format '" + resultType + "'' are not supported by the VSO/TFS OSX and Linux build agent");
        }

        if (reader != null)
        {
            var testRunPublisher = new trp.TestRunPublisher(this.taskCtx.service, command, teamProject, testRunContext, reader);

            testRunPublisher.publishTestRun(resultFilePath).then(function (createdTestRun) {
                defer.resolve(null);
            },
            function (err)
            {
                defer.reject(err);
            });
        }

        return defer.promise;
    }   
}

