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
        
        if (!xmlContent.report || !xmlContent.report.at(0) || !xmlContent.report.at(0).counter) {            
            return null;
        }
        var coverage = new CodeCoverageSummary();
        var reportNode = xmlContent.report.at(0);
        
        var nodeLength = reportNode.counter.count();
        var coverageStats = [];
        for (var i = 0; i < nodeLength; i++) {
            var counterNode = reportNode.counter.at(i);
			var attributes = counterNode.attributes();
			if(attributes && attributes.type && attributes.covered && attributes.missed){
				var coverageStat = SummaryReaderUtilities.getCodeCoverageStatistics(attributes.type, attributes.covered, Number(attributes.covered) + Number(attributes.missed), attributes.type);
				coverageStats.push(coverageStat);
			}
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
        
        if (!xmlContent.coverage || !xmlContent.coverage.at(0) || !xmlContent.coverage.at(0).attributes()) {            
            return null;
        }
		
		var coverageStats = [];
        var coverage = new CodeCoverageSummary();
        var coverageNode = xmlContent.coverage.at(0);        
		var attributes = coverageNode.attributes();
         
        var linesTotal = attributes['lines-valid'];
        var linesCovered = attributes['lines-covered'];
        var branchesCovered = attributes['branches-covered'];
        var branchesTotal = attributes['branches-valid'];
        
        if(linesTotal && linesCovered)
        {
		    var coverageStat = SummaryReaderUtilities.getCodeCoverageStatistics("Lines", linesCovered, linesTotal, "line");
            coverageStats.push(coverageStat);
        }
        
        if(branchesCovered && branchesTotal)
        {
			var coverageStat = SummaryReaderUtilities.getCodeCoverageStatistics("Branches", branchesCovered, branchesTotal, "branch");
            coverageStats.push(coverageStat);
        }
        
        coverage.addResults(coverageStats);
        
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
    
	public static getCodeCoverageStatistics(label:string, covered:number, total: number, priorityTag: string): testifm.CodeCoverageStatistics
	{
		var coverageStat: testifm.CodeCoverageStatistics = <testifm.CodeCoverageStatistics>{
            label: label,
            covered: covered,
            total: total,
            position: SummaryReaderUtilities.getCoveragePriorityOrder(priorityTag)
        }
		return coverageStat;
	}
	
    public static getCodeCoverageData(codeCoverageSummary: CodeCoverageSummary): testifm.CodeCoverageData{
		if(!codeCoverageSummary){
			return null;
		}
		
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