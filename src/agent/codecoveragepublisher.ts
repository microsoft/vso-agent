import testifm = require('vso-node-api/interfaces/TestInterfaces');
import ctxm = require('./context');
import cm = require('./common');
import utilities = require('./utilities');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import fc = require('./filecontainerhelper');
import Q = require('q');

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
    // publish code coverage results to server
    // - codeCoverageResults: code coverage data to publish  
    //-----------------------------------------------------
    public publishCodeCoverageSummary(codeCoverageResults: testifm.CodeCoverageData) {
        var _this = this;
        _this.executionContext.service.publishCodeCoverageSummary(codeCoverageResults, _this.project, _this.buildId);
    }
    
    //-----------------------------------------------------
    // publish code coverage files to server
    // - reportDirectory: code coverage report directory
    // - additionalCodeCoverageFiles: additional code coverage files
    //-----------------------------------------------------
    public publishCodeCoverageFiles(reportDirectory: string, additionalCodeCoverageFiles: string) {
        
        var _this = this;            
        
        if(reportDirectory) {
            var containerId = parseInt(_this.executionContext.variables[ctxm.WellKnownVariables.containerId]);
            var artifactName = "Code Coverage Report_" + _this.buildId;
            var containerFolder = "/" + artifactName;
            
            _this.executionContext.verbose("came to publish1");
            return fc.copyToFileContainer(_this.executionContext, reportDirectory, containerId, containerFolder).then((artifactLocation: string) => {
			//_this.command.info('Associating artifact ' + artifactLocation + ' ...');
		    _this.executionContext.verbose("came to publish");
			var buildId: number = parseInt(_this.executionContext.variables[ctxm.WellKnownVariables.buildId]);
			var artifact: buildifm.BuildArtifact = <buildifm.BuildArtifact>{
				name: artifactName,
				resource: {
					type: "container",
					data: artifactLocation
				}
			};
			
			var webapi = _this.executionContext.getWebApi();
			var buildClient = webapi.getQBuildApi();
			return buildClient.createArtifact(artifact, buildId, _this.executionContext.variables[ctxm.WellKnownVariables.projectId]);
		  });
        }
        // if (reportDirectory) {
        //     var containerId = parseInt(_this.executionContext.variables[ctxm.WellKnownVariables.containerId]);
        //     var artifactName = "Code Coverage Report_" + _this.buildId;
        //     var data = {
        //         artifacttype: "container",
        //         artifactname: artifactName
        //     };   
        //     
        //     fc.copyToFileContainer(_this.executionContext, reportDirectory, containerId, artifactName).then((artifactLocation: string) => {
        //         var artifact: buildifm.BuildArtifact = <buildifm.BuildArtifact>{
        //             name: artifactName,
        //             resource: {
        //                 type: "container",
        //                 data: artifactLocation
        //             }
        //         };
        //         _this.executionContext.service.postArtifact(_this.project, _this.buildId, artifact);
        //     }).fail(function(err){
        //         defer.reject(err);
        //     });
        // }        
    }
    
    //-----------------------------------------------------
    // Publish code coverage
    //-----------------------------------------------------
    public publishCodeCoverage(): Q.Promise<any> {
        var defer = Q.defer();        
        var _this = this;
        var testRunId;
        var results;
        var summaryFile = _this.command.properties["summaryfile"];
        var reportDirectory = _this.command.properties["reportdirectory"]; 
        var additionalCodeCoverageFiles = _this.command.properties["additionalcodecoveragefiles"];
		
        _this.readCodeCoverageSummary(summaryFile).then(function(codeCoverageData) {
            if (codeCoverageData) {
                _this.publishCodeCoverageSummary(codeCoverageData);
                return true;
            }
            return false;
        }).then(function(isCodeCoverageSummaryPublished) {
            if (isCodeCoverageSummaryPublished) {  
                 _this.publishCodeCoverageFiles(reportDirectory, additionalCodeCoverageFiles);               
                 defer.resolve("Success");
            }
            else{
                defer.resolve(null);
            }
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