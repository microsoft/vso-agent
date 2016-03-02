import testifm = require('vso-node-api/interfaces/TestInterfaces');
import ctxm = require('./context');
import cm = require('./common');
import utilities = require('./utilities');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import fc = require('./filecontainerhelper');
import Q = require('q');
var shell = require('shelljs');
var path = require('path');

export class CodeCoveragePublisher {
   
    constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand, reader: ICodeCoverageReader) {        
        this.executionContext = executionContext;
        this.command = command;
        this.codeCoverageReader = reader;
        this.buildId = parseInt(this.executionContext.variables[ctxm.WellKnownVariables.buildId]);
        this.project = this.executionContext.variables[ctxm.WellKnownVariables.projectId];
    }

    private executionContext: cm.IExecutionContext;

    private command: cm.ITaskCommand;  
    
    private codeCoverageReader: ICodeCoverageReader;

    private buildId: number;

    private project: string;    

    //-----------------------------------------------------
    // Read code coverage results from summary file.
    // - codeCoverageSummaryFile: string () - location of the code coverage summary file 
    //-----------------------------------------------------    
    private readCodeCoverageSummary(codeCoverageSummaryFile: string): Q.Promise<testifm.CodeCoverageData> {
        var defer = Q.defer<testifm.CodeCoverageData>();
        var _this = this;
        if(codeCoverageSummaryFile){
            _this.codeCoverageReader.getCodeCoverageSummary(codeCoverageSummaryFile).then(function(codeCoverageStatistics) {
                defer.resolve(codeCoverageStatistics);
            }).fail(function(err) {
                defer.reject(err);
            }); 
        }
        else{
            defer.resolve(null);
        }

        return defer.promise;
    } 
    
    //-----------------------------------------------------
    // publish code coverage files to server
    // - reportDirectory: code coverage report directory
    // - additionalCodeCoverageFiles: additional code coverage files
    //-----------------------------------------------------
    public publishCodeCoverageFiles(): Q.Promise<any> {
      var defer = Q.defer();  
      var containerId = parseInt(this.executionContext.variables[ctxm.WellKnownVariables.containerId]);
      var summaryFile = this.command.properties["summaryfile"];
      var reportDirectory = this.command.properties["reportdirectory"]; 
      var additionalCodeCoverageFiles = this.command.properties["additionalcodecoveragefiles"];
      
      if(!reportDirectory){
          reportDirectory = path.join(shell.tempdir(), "CodeCoverageReport_" + this.buildId);
          shell.mkdir('-p', reportDirectory);
      }
      
      // copy the summary file into report directory
      shell.cp('-f', summaryFile, reportDirectory);
      
      if(reportDirectory){
        var artifactName = "Code Coverage Report_" + this.buildId; 
        var ret = fc.copyToFileContainer(this.executionContext, reportDirectory, containerId, "/" + artifactName).then((artifactLocation: string) => {
            this.command.info('Associating artifact ' + artifactLocation + ' ...');
		
			var buildId: number = this.buildId;
			var artifact: buildifm.BuildArtifact = <buildifm.BuildArtifact>{
				name: artifactName,
				resource: {
					type: "container",
					data: artifactLocation
				}
			};
			
			var webapi = this.executionContext.getWebApi();
			var buildClient = webapi.getQBuildApi();
			return buildClient.createArtifact(artifact, buildId, this.executionContext.variables[ctxm.WellKnownVariables.projectId]);
		}).fail(function(err) {
            defer.reject(err);
        });  
      }
      
      defer.resolve(ret);
      return defer.promise;      
    }
    
    //-----------------------------------------------------
    // Publish code coverage
    //-----------------------------------------------------
    public publishCodeCoverageSummary(): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();        
        var _this = this;
        var summaryFile = _this.command.properties["summaryfile"];
       
        _this.readCodeCoverageSummary(summaryFile).then(function(codeCoverageData) {
            if (codeCoverageData) {
                _this.executionContext.service.publishCodeCoverageSummary(codeCoverageData, _this.project, _this.buildId);
                defer.resolve(true);
            }
            defer.resolve(false);
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }
}

//-----------------------------------------------------
// Interface to be implemented by all code coverage result readers 
//-----------------------------------------------------
export interface ICodeCoverageReader {
    // reads code coverage results from summary file   
    getCodeCoverageSummary(summaryFilePath: string): Q.Promise<testifm.CodeCoverageData>;
}