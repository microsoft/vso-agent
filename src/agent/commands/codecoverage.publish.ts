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

        var codeCoverageTool = this.command.properties["codecoveragetool"];
        if (!codeCoverageTool) {
            var err = new Error("No code coverage tool is provided.");
            defer.reject(err);
            return defer.promise;
        }

        var summaryFile = this.command.properties["summaryfile"];
        if (!summaryFile) {
            var err = new Error("No code coverage summary file is provided.");
            defer.reject(err);
            return defer.promise;
        }

        if (!utilities.isFileExists(summaryFile)) {
            var err = new Error("Code coverage summary file '" + summaryFile + "' doesnot exist or it is not a valid file.");
            defer.reject(err);
            return defer.promise;
        }

        var reader;
        switch (codeCoverageTool.toLowerCase()) {
            case "jacoco":
                reader = new ccsr.JacocoSummaryReader(this.command);
                break;
            case "cobertura":
                reader = new ccsr.CoberturaSummaryReader(this.command);
                break;
            default:
                var err = new Error("Code coverage tool '" + codeCoverageTool + "' is not supported.");
                defer.reject(err);
                return defer.promise;
        }

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(this.executionContext, this.command, reader);
        codeCoveragePublisher.publishCodeCoverageSummary().then(function() {
            codeCoveragePublisher.publishCodeCoverageFiles().then(function() {
                defer.resolve(true);
            }).fail(function(error) {
                defer.reject(error);
            });
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }
}