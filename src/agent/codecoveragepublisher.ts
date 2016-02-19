import ifm = require('./interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import ctxm = require('./context');
import cm = require('./common');
import utilities = require('./utilities');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import fc = require('./filecontainerhelper');

var async = require('async');
var fs = require('fs');
var path = require("path");
var xmlreader = require('xmlreader');
var Q = require('q');

export class CodeCoveragePublisher {
    //-----------------------------------------------------
    // Constructs a TestRunPublisher instance 
    // - service: cm.IFeedbackChannel - for routing the server calls to real or loopback 
    // - command: cm.ITaskCommand - used for logging warnings, errors  
    // - teamProject: string - since test publishing is scoped to team projects 
    // - runContext: TestRunContext - for identifying context(buildId, platform, config, etc), which is needed while publishing
    // - reader: IResultReader - for reading different(junit, nunit) result files 
    //-----------------------------------------------------
    constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand, reader: ICodeCoverageReader) {        
        this.command = command;
        this.codeCoverageReader = reader;
        this.executionContext = executionContext;
        this.buildId = parseInt(this.executionContext.variables[ctxm.WellKnownVariables.buildId]);
        this.project = this.executionContext.variables[ctxm.WellKnownVariables.projectId];        
    }

    // used for logging warnings, errors  
    private command: cm.ITaskCommand;  
    
    
    // for reading different(junit, nunit) result files 
    private codeCoverageReader: ICodeCoverageReader;
    
    private buildId: number;
    
    private project: string;
    
    private executionContext: cm.IExecutionContext;

    //-----------------------------------------------------
    // Read results from a file. Each file will be published as a separate test run
    // - file: string () - location of the results file 
    //-----------------------------------------------------    
    private readCodeCoverageSummary(file: string): Q.Promise<testifm.CodeCoverageData> {
        var defer = Q.defer();

        var codeCoverageStatistics: testifm.CodeCoverageData;

        this.codeCoverageReader.getCodeCoverageSummary(file).then(function (codeCoverageStatistics) {
            defer.resolve(codeCoverageStatistics);
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
    public publishCodeCoverageSummary(codeCoverageResults: testifm.CodeCoverageData) {       
        var _this = this;        
        _this.executionContext.service.publishCodeCoverageSummary(codeCoverageResults, _this.project, _this.buildId);
     }

    public publishCodeCoverageFiles() {
        var reportDirectory = this.command.properties["reportdirectory"];
        var containerId = parseInt(this.executionContext.variables[ctxm.WellKnownVariables.containerId]);
        var artifactName = "Code Coverage Report_" + this.buildId;
        if(reportDirectory) {
        
            fc.copyToFileContainer(this.executionContext, reportDirectory, containerId, artifactName).then((artifactLocation: string) => {
			this.command.info('Associating artifact ' + artifactLocation + ' ...');
		
			var artifact: buildifm.BuildArtifact = <buildifm.BuildArtifact>{
				name: artifactName,
				resource: {
					type: "container",
					data: artifactLocation
				}
			};
			
            this.executionContext.service.postArtifact(this.project, this.buildId, artifact);
		});
        }
    }
    
    //-----------------------------------------------------
    // Publish a test run
    // - resultFilePath: string - Path to the results file
    //-----------------------------------------------------
    public publishCodeCoverage(): Q.Promise<testifm.TestRun> {
        var defer = Q.defer();
        
        var _this = this;
        var testRunId;
        var results; 
        var summaryFile = this.command.properties["summaryfile"];
        var reportDirectpory = this.command.properties["reportdirectory"]

        _this.readCodeCoverageSummary(summaryFile).then(function (codeCoverageData) { 
            if(codeCoverageData)
            {          
              _this.publishCodeCoverageSummary(codeCoverageData);
              return true;
            }
            return false;
        }).then(function (isCodeCoverageSummaryPublished) {
            if(isCodeCoverageSummaryPublished)
            {
               _this.publishCodeCoverageFiles();
            }
        }).fail(function (err) {
            defer.reject(err);
        }); 

        return defer.promise;
    }
}

//-----------------------------------------------------
// Interface to be implemented by all result readers 
//-----------------------------------------------------
export interface ICodeCoverageReader {
    // Reads a test results file from disk  
    getCodeCoverageSummary(filePath: string): testifm.CodeCoverageData; 
}