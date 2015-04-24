import ctxm = require('../context');
import cm = require('../common');
import trp = require('../testrunpublisher');

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

        setTimeout(() => {
            //
            // TODO : How to identify team Project and collection uri 
            //
            var collectionUrl: string = "";
            var teamProject: string = ""; 

            var resultFilePath: string = this.command.message;
            var resultType: string = this.command.properties['type'].toLowerCase();
            var command: cm.ITaskCommand = this.command;

            var testRunPublisher = new trp.TestRunPublisher(collectionUrl, teamProject, this.taskCtx);
            var testRun = testRunPublisher.ReadResultsFromFile(resultFilePath, resultType);
            var results = testRun.testResults;

            testRunPublisher.StartTestRun(testRun.testRun).then(function (createdTestRun) {
                
                var testRunId: number = createdTestRun.id;

                testRunPublisher.AddResults(testRunId, results).then(function (createdTestRunResults) {
                    
                    testRunPublisher.EndTestRun(testRunId).then(function (createdTestRun) {

                        // resolve or reject must get called!  In this sample, if you set result=fail, then it forces a failure
                        if (command.properties && command.properties['result'] === 'fail') {

                            // reject with an error will fail the task (and the build if not continue on error in definition)
                            // if you don't want an error condition to fail the build, do command.error (above) and call resolve.
                            defer.reject(new Error(command.message));
                            return;
                        }
                        else {
                            defer.resolve(null);
                        }
                    });      
                });
            });
        }, 2000);

        return defer.promise;
    }   
}

