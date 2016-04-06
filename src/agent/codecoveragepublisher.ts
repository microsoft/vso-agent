import testifm = require('vso-node-api/interfaces/TestInterfaces');
import ctxm = require('./context');
import cm = require('./common');
import utilities = require('./utilities');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import fc = require('./filecontainerhelper');
import Q = require('q');
import fs = require('fs');

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
    public publishCodeCoverageSummary(): Q.Promise<any> {
        var defer = Q.defer<any>();
        var _this = this;
        var summaryFile = _this.command.properties["summaryfile"];

        _this.readCodeCoverageSummary(summaryFile).then(function(codeCoverageData) {
            if (codeCoverageData && codeCoverageData.coverageStats && codeCoverageData.coverageStats.length > 0) {
                _this.executionContext.service.publishCodeCoverageSummary(codeCoverageData, _this.project, _this.buildId)
                    .then(function(result) {
                        _this.command.info("PublishCodeCoverageSummary : Code coverage summary published successfully.");
                        defer.resolve(null);
                    }).fail(function(error) {
                        _this.command.warning("PublishCodeCoverageSummary : Error occured while publishing code coverage summary. Error: " + error);
                        defer.reject(error);
                    });
            }
            else {
                _this.command.warning("PublishCodeCoverageSummary : No code coverage data found to publish.");
                defer.resolve(null);
            }
        }).fail(function(err) {
            _this.command.warning("PublishCodeCoverageSummary : Error occured while reading code coverage summary. Error : " + err);
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
        var _this = this;
        var containerId = parseInt(_this.executionContext.variables[ctxm.WellKnownVariables.containerId]);
        var summaryFile = _this.command.properties["summaryfile"];
        var reportDirectory = _this.command.properties["reportdirectory"];
        var additionalCodeCoverageFiles = _this.command.properties["additionalcodecoveragefiles"];
        var codeCoverageArtifactName = "Code Coverage Report_" + _this.buildId;
        var reportDirectoryExists = false;
        var newReportDirectory = reportDirectory;

        if (reportDirectory && reportDirectory.length > 0) {
            if (utilities.isDirectoryExists(reportDirectory)) {
                reportDirectoryExists = true;
            }
            else {
                _this.command.warning("Report directory '" + reportDirectory + "' doesnot exist or it is not a directory.");
            }
        }

        if (!reportDirectoryExists) {
            newReportDirectory = path.join(shell.tempdir(), "CodeCoverageReport_" + _this.buildId);
            shell.mkdir('-p', newReportDirectory);
        }
      
        // copy the summary file into report directory
        shell.cp(summaryFile, newReportDirectory);

        _this.command.info("PublishCodeCoverageFiles : Publishing code coverage report '" + newReportDirectory + "'");
        
        _this.uploadArtifact(newReportDirectory, codeCoverageArtifactName, containerId, _this.isReportDirectoryBrowsable(newReportDirectory)).then(function() {
            try {
                _this.command.info("PublishCodeCoverageFiles : Code coverage report published successfully.");

                // clean the temporary report directory created.
                if (!reportDirectoryExists) {
                    shell.rm('-rf', newReportDirectory);
                }

                if (!additionalCodeCoverageFiles || !(additionalCodeCoverageFiles.split(",")) || additionalCodeCoverageFiles.split(",").length <= 0) {
                    _this.command.info("PublishCodeCoverageFiles : No additional codecoverage files found to publish.");
                    defer.resolve(null);
                    return defer.promise;
                }

                var rawFiles: string[] = additionalCodeCoverageFiles.split(",");
                var rawFilesDirectory = path.join(shell.tempdir(), "CodeCoverageFiles_" + _this.buildId);
                shell.mkdir('-p', rawFilesDirectory);
                _this.copyRawFiles(rawFiles, rawFilesDirectory);
                var rawFilesArtifactName = "Code Coverage Files_" + _this.buildId;

                _this.command.info("PublishCodeCoverageFiles : Publishing additional code coverage files '" + rawFilesDirectory + "'");
                _this.uploadArtifact(rawFilesDirectory, rawFilesArtifactName, containerId, "False").then(function() {
                    // clean the temporary additional files folder created.
                    shell.rm('-rf', rawFilesDirectory);

                    _this.command.info("PublishCodeCoverageFiles : Additional code coverage files published successfully.");
                    defer.resolve(null);
                }).fail(function(error) {
                    defer.reject(error);
                });
            }
            catch (err) {
                defer.reject(err);
            }

        }).fail(function(error) {
            defer.reject(error);
        });

        return defer.promise;
    }

    //-----------------------------------------------------
    // copies all the additionalcodecoveragefiles into rawFilesDirectory
    // if there are files with the same name both are copied by maintaining distinguishing directory structure
    // For example, usr/admin/a.xml and usr/admin2/a.xml are copied as admin/a.xml and admin2/a.xml into rawFilesDirectory
    //-----------------------------------------------------
    private copyRawFiles(additionalCodeCoverageFiles: string[], rawFilesDirectory: string) {
        if (additionalCodeCoverageFiles.length > 1) {
            additionalCodeCoverageFiles = utilities.sortStringArray(additionalCodeCoverageFiles);
            var numberOfFiles = additionalCodeCoverageFiles.length;
            var commonPath = utilities.sharedSubString(additionalCodeCoverageFiles[0], additionalCodeCoverageFiles[numberOfFiles - 1])
        }

        additionalCodeCoverageFiles.forEach(file => {
            if (commonPath) {
                var newFile: string = file.replace(commonPath, "");
            }
            else {
                var newFile: string = path.basename(file);
            }

            newFile = path.join(rawFilesDirectory, newFile);
            shell.mkdir('-p', path.dirname(newFile));
            shell.cp('-f', file, newFile)
        });
    }

    //-----------------------------------------------------
    // Helper function to upload artifact to server
    // - path: Path of the directory to uploaded to server
    // - artifactName: name of teh artifact
    // - containerId: containerId 
    //-----------------------------------------------------
    private uploadArtifact(path: string, artifactName: string, containerId: number, browsable: string): Q.Promise<any> {
        var defer = Q.defer();
        var properties = {};
        properties["browsable"] = browsable;
        fc.copyToFileContainer(this.executionContext, path, containerId, "/" + artifactName).then((artifactLocation: string) => {
            try {
                this.command.info('Associating artifact ' + artifactLocation + ' ...');
                var artifact: buildifm.BuildArtifact = <buildifm.BuildArtifact>{
                    name: artifactName,
                    resource: {
                        type: "container",
                        data: artifactLocation,
                        properties: properties
                    },
                };

                this.executionContext.service.postArtifact(this.project, this.buildId, artifact).fail(function(err) {
                    defer.reject(err);
                    return defer.promise;
                })
                defer.resolve(null);
            }
            catch (error) {
                defer.reject(error);
            }

        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }
    
    //-----------------------------------------------------
    // Finds if the report directory has index.html
    // - reportDirectory: string  - report directory 
    //-----------------------------------------------------    
    private isReportDirectoryBrowsable(reportDirectory: string): string {
        var defaultIndexFile = path.join(reportDirectory, "index.html");
        if(utilities.isFileExists(defaultIndexFile)){
            return "True";
        }
        return "False";
    }
    
    //-----------------------------------------------------
    // Read code coverage results from summary file.
    // - codeCoverageSummaryFile: string  - location of the code coverage summary file 
    //-----------------------------------------------------    
    private readCodeCoverageSummary(codeCoverageSummaryFile: string): Q.Promise<testifm.CodeCoverageData> {
        var defer = Q.defer<testifm.CodeCoverageData>();
        var _this = this;
        if (codeCoverageSummaryFile) {
            _this.codeCoverageReader.getCodeCoverageSummary(codeCoverageSummaryFile).then(function(codeCoverageStatistics) {
                defer.resolve(codeCoverageStatistics);
            }).fail(function(err) {
                defer.reject(err);
            });
        }
        else {
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