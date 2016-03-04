import cm = require('../common');
import ccp = require('../codecoveragepublisher');
import ccsr = require('../codecoveragesummaryreader');
import Q = require('q');
import fc = require('../filecontainerhelper');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import ctxm = require('../context');
import fs = require('fs');
import utilities = require('../utilities');

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

    public runCommandAsync(): Q.Promise<any> {
        var defer = Q.defer();

        var codeCoverageTool: string = this.command.properties['codecoveragetool'];

        var reader;
        if (!codeCoverageTool) {
            var err = new Error("No code coverage tool provided");
            defer.reject(err);
        }

        var summaryFile = this.command.properties["summaryfile"];
        if (!summaryFile) {
            var err = new Error("No code coverage summary file provided");
            defer.reject(err);
        }

        if (!fs.existsSync(summaryFile)) {
            var err = new Error("Code coverage summary file '" + summaryFile + "' doesnot exist.");
            defer.reject(err);
        }

        switch (codeCoverageTool.toLowerCase()) {
            case "jacoco":
                reader = new ccsr.JacocoSummaryReader(this.command);
                break;
            case "cobertura":
                reader = new ccsr.CoberturaSummaryReader(this.command);
                break;
            default:
                // print an error message and return
                var err = new Error("Code coverage tool not supported");
                defer.reject(err);
        }

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(this.executionContext, this.command, reader);
        var summaryPublished = codeCoveragePublisher.publishCodeCoverageSummary().then(function(response) {
            return response;
        }).fail((err) => {
            defer.reject(err);
        });

        if (summaryPublished) {
            return codeCoveragePublisher.publishCodeCoverageFiles();
        }

        defer.resolve(null);
        return defer.promise;
    }
}