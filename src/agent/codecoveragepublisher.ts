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
      var codeCoverageArtifactName = "Code Coverage Report_" + this.buildId; 
      var newReportDirectory = reportDirectory;
      
      if(!newReportDirectory){
          newReportDirectory = path.join(shell.tempdir(), "CodeCoverageReport_" + this.buildId);
          shell.mkdir('-p', newReportDirectory);
      }
      
      // copy the summary file into report directory
      shell.cp('-f', summaryFile, newReportDirectory);
      
      var ret = this.uploadArtifact(reportDirectory, codeCoverageArtifactName, containerId);
      
      if(additionalCodeCoverageFiles){
          this.command.info("here");
          var rawFilesDirectory = path.join(shell.tempdir(), "CodeCoverageFiles_" + this.buildId);
          shell.mkdir('-p', rawFilesDirectory);
          var rawFiles : string[] = additionalCodeCoverageFiles.split(",");
          this.copyRawFiles(rawFiles, rawFilesDirectory);
          var rawFilesArtfactName = "Code Coverage Files_" + this.buildId
          ret = this.uploadArtifact(rawFilesDirectory, rawFilesArtfactName, containerId);
      }
      
      // clean generated directories
      if(!reportDirectory){
          shell.rm('-rf', newReportDirectory);
      }
      
      if(additionalCodeCoverageFiles){
          shell.rm('rf', rawFilesDirectory);
      }
      
      defer.resolve(ret);
      return defer.promise;      
    }
    
    private copyRawFiles(additionalCodeCoverageFiles : string[], rawFilesDirectory : string){
        if(additionalCodeCoverageFiles.length >1){
            additionalCodeCoverageFiles = this.sortStringArray(additionalCodeCoverageFiles); 
            var numberOfFiles = additionalCodeCoverageFiles.length; 
            var commonPath = this.sharedSubString(additionalCodeCoverageFiles[0], additionalCodeCoverageFiles[numberOfFiles-1] )  
        }
        
        additionalCodeCoverageFiles.forEach(file => {
            if(commonPath){
                var newFile : string = file.replace(commonPath, "");
            }
            else{
                var newFile : string = path.basename(file);
            }
            
            newFile = path.join(rawFilesDirectory, newFile);
            shell.mkdir('-p', path.dirname(newFile));
            shell.cp('-f', file, newFile)
        });
    }
    
    private sharedSubString(string1: string, string2: string): string{
        var ret  = "";
        var index = 1;
        while(string1.substring(0, index) == string2.substring(0, index)){
            ret = string1.substring(0, index);
            index++;
        }
        return ret;
    }
    
    private sortStringArray(files): string[]{
        var sortedFiles : string[] = files.sort((a, b) =>{
            if(a > b){
                return 1;
            }
            else if(a < b){
                return -1;
            }
            else{
                return 0;
            }
        });
        return sortedFiles;
    }
    
    private uploadArtifact(path :string, artifactName: string, containerId : number) : Q.Promise<any> {
        var defer = Q.defer(); 
        return fc.copyToFileContainer(this.executionContext, path, containerId, "/" + artifactName).then((artifactLocation: string) => {
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
}

//-----------------------------------------------------
// Interface to be implemented by all code coverage result readers 
//-----------------------------------------------------
export interface ICodeCoverageReader {
    // reads code coverage results from summary file   
    getCodeCoverageSummary(summaryFilePath: string): Q.Promise<testifm.CodeCoverageData>;
}