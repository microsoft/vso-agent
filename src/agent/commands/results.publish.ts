import ctxm = require('../context');
import cm = require('../common');
import trp = require('../testrunpublisher');
import trr = require('../testresultreader');
import ifm = require('../api/interfaces');

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
        
        var resultFiles = [];
        resultFiles = resultFiles.concat(this.command.message.split(",")); //TOOD: need a reliable way to pass in array of file paths since "," is valid character in file path, JSON object?
        var resultType: string = this.command.properties['type'].toLowerCase();
        
        var mergeResults = this.command.properties['mergeResults'];
        if(!mergeResults) { mergeResults = "false"; }
        mergeResults = mergeResults.toLowerCase();

        var platform = this.command.properties['platform'];
        if(!platform) { platform = ""; }

        var config = this.command.properties['configuration'];
        if(!config) { config = ""; }
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

            if(mergeResults == "true") {
                //create test run data
                var testRun: ifm.TestRun = <ifm.TestRun>    {
                    name: resultType + "_TestResults_" + testRunContext.buildId,
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
                    startDate: new Date(),
                    releaseUri: "",
                    build: { id: testRunContext.buildId }
                };       

                testRunPublisher.publishMergedTestRun(testRun, resultFiles).then(function (createdTestRun) {
                    defer.resolve(null);
                },
                function (err)
                {
                    defer.reject(err);
                });
                   
            }    
            else {
                //publish separate test run for each test result file
                for(var i = 0; i < resultFiles.length; i ++) {
                    testRunPublisher.publishTestRun(resultFiles[i]).then(function (createdTestRun) {
                        defer.resolve(null);
                    },
                    function (err)
                    {
                        defer.reject(err);
                    });
                } 
            }        
        }
        else 
        {
            defer.resolve(null);
        }

        return defer.promise;
    }   
}
