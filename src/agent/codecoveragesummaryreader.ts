import ifm = require('./interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import ccp = require('./codecoveragepublisher');
import utilities = require('./utilities');
import cm = require('./common');

var Q = require('q');
var xmlreader = require('xmlreader');

export class CodeCoverageSummary {
    results: testifm.CodeCoverageStatistics[];

    constructor() {
        this.results = [];
    }

    addResults(res) {
        this.results = this.results.concat(res);
    }
}

export class JacocoSummaryReader implements ccp.ICodeCoverageReader {

    private command: cm.ITaskCommand;

    constructor(command: cm.ITaskCommand) {
        this.command = command;
    }

    public getCodeCoverageSummary(summaryFilePath: string): Q.Promise<testifm.CodeCoverageData> {
        var defer = Q.defer();
        var _this = this;
        
        SummaryReaderUtilities.getXmlContent(summaryFilePath).then(function(xmlContents) {
            var codeCoverageSummary = _this.parseJacocoXmlReport(xmlContents);
            var codeCoverageData = SummaryReaderUtilities.getCodeCoverageData(codeCoverageSummary);
            defer.resolve(codeCoverageData);            
            }).fail(function(err) {
                defer.reject(err);
            });
            
            return defer.promise;
    }
    
    private parseJacocoXmlReport(xmlContent): CodeCoverageSummary {     
        
        if (!xmlContent.report || !xmlContent.report.at(0)) {
            
            return null;
        }
        var coverage = new CodeCoverageSummary();
        var reportNode = xmlContent.report.at(0);
        
        var nodeLength = reportNode.counter.count();
        var coverageStats = []
        for (var i = 0; i < nodeLength; i++) {
            var counterNode = reportNode.counter.at(i);
            var coverageStat: testifm.CodeCoverageStatistics = <testifm.CodeCoverageStatistics>{
                label: counterNode.attributes().type,
                covered: counterNode.attributes().covered,
                total: Number(counterNode.attributes().covered) + Number(counterNode.attributes().missed),
                position: SummaryReaderUtilities.getCoveragePriorityOrder(counterNode.attributes().type)
            }

            coverageStats.push(coverageStat);
        }
        coverage.addResults(coverageStats);
        
        return coverage;
    }
}

export class CoberturaSummaryReader implements ccp.ICodeCoverageReader {

    public command: cm.ITaskCommand;

    constructor(command: cm.ITaskCommand) {
        this.command = command;
    }

    public getCodeCoverageSummary(summaryFilePath: string): Q.Promise<testifm.CodeCoverageData> {
        var defer = Q.defer();
        var _this = this;
        
        SummaryReaderUtilities.getXmlContent(summaryFilePath).then(function(xmlContents) {
            var codeCoverageSummary = _this.parseCoberturaXmlReport(xmlContents);
            var codeCoverageData = SummaryReaderUtilities.getCodeCoverageData(codeCoverageSummary);
            defer.resolve(codeCoverageData);            
            }).fail(function(err) {
                defer.reject(err);
            });
            
            return defer.promise;
    }
    
    private parseCoberturaXmlReport(xmlContent): CodeCoverageSummary {     
        
        if (!xmlContent.coverage || !xmlContent.coverage.at(0)) {
            
            return null;
        }
        var coverage = new CodeCoverageSummary();
        var coverageNode = xmlContent.coverage.at(0);
        
        //lines
      //  var linesCovered = coverageNode.attributes().lines-covered
        //branches
        var coverageStats = []
//         for (var i = 0; i < nodeLength; i++) {
//             var counterNode = reportNode.counter.at(i);
//             var coverageStat: testifm.CodeCoverageStatistics = <testifm.CodeCoverageStatistics>{
//                 label: counterNode.attributes().type,
//                 covered: counterNode.attributes().covered,
//                 total: Number(counterNode.attributes().covered) + Number(counterNode.attributes().missed),
//                 position: SummaryReaderUtilities.getCoveragePriorityOrder(counterNode.attributes().type)
//             }
// 
//             coverageStats.push(coverageStat);
//         }
//         coverage.addResults(coverageStats);
        
        return coverage;
    }  
     
}

export class SummaryReaderUtilities {
    
    public static getXmlContent(summaryFile: string): Q.Promise<any> {
        var defer = Q.defer();
      
        utilities.readFileContents(summaryFile, "utf-8").then(function(contents) {
            xmlreader.read(contents, function(err, res) {
            if (err) {
                defer.reject(err);
            }
            else {
                try {                    
                    defer.resolve(res);
                }
                catch (ex) {
                    defer.reject(err);
                }
            }
            });
        }).fail(function(err) {
            defer.reject(err);
        });
        
        return defer.promise;
    }
    
    public static getCodeCoverageData(codeCoverageSummary: CodeCoverageSummary): testifm.CodeCoverageData{
        var codeCoverageData: testifm.CodeCoverageData = <testifm.CodeCoverageData>{
                // <todo: Bug 402783> We are currently passing BuildFlavor and BuildPlatform = "" There value are required be passed to commandlet
                buildFlavor: "",
                buildPlatform: "",
                coverageStats: codeCoverageSummary.results
            }
        return codeCoverageData;
    }
    
     public static getCoveragePriorityOrder(label: string): Number {
        if (label.toLowerCase() == 'instruction') {
            return 5;
        }
        else if (label.toLowerCase() == 'line') {
            return 4;
        }
        else if (label.toLowerCase() == 'method') {
            return 3;
        }
        else if (label.toLowerCase() == 'complexity') {
            return 2;
        }
        else if (label.toLowerCase() == 'class') {
            return 1;
        }
        return 6;
    }
}