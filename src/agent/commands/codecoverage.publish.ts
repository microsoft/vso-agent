import ctxm = require('../context');
import cm = require('../common');
import ccp = require('../codecoveragepublisher');
import ccsr = require('../codecoveragesummaryreader');
import Q = require('q');

//-----------------------------------------------------
// Publishes results from a specified file to TFS server 
// - CMD_PREFIX + "codecoverage.publish type=junit]" + testResultsFile
//-----------------------------------------------------

export function createAsyncCommand(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
    return new CodeCoveragePublishCommand(executionContext, command);
}

export class CodeCoveragePublishCommand implements cm.IAsyncCommand {
    constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
        this.command = command;
        this.executionContext = executionContext;
        this.description = "CodeCoverage.Publish async Command";
    }

    public command: cm.ITaskCommand;
    public executionContext: cm.IExecutionContext;
    public description: string;

    public runCommandAsync() {
        var defer = Q.defer();        

        var codeCoverageTool: string = this.command.properties['codecoveragetool'];

        var reader;
        if (codeCoverageTool == "jacoco") {
            reader = new ccsr.JacocoSummaryReader();
        }      
        else{ 
            this.command.warning("Publish code coverage of format '" + codeCoverageTool + "'' are not supported on this build agent");
        }

        if (reader != null) {
            var testRunPublisher = new ccp.CodeCoveragePublisher(this.executionContext, this.command, reader);
            testRunPublisher.publishCodeCoverage()
                .fail((err) => {
                    this.command.warning("Failed to publish code coverage summary " + err.message);
                    defer.resolve(null);
                });
        }
        else {
            defer.resolve(null);
        }

        return defer.promise;
    }
}