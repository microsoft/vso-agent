import ifm = require('./interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import ccp = require('./codecoveragepublisher');
import utilities = require('./utilities');
import cm = require('./common');
import Q = require('q');

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
        var defer = Q.defer<testifm.CodeCoverageData>();
        var _this = this;

        SummaryReaderUtilities.getXmlContent(summaryFilePath).then(function(xmlContents) {
            _this.parseJacocoXmlReport(xmlContents).then(function(codeCoverageSummary) {
                defer.resolve(SummaryReaderUtilities.getCodeCoverageData(codeCoverageSummary));
            })
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    private parseJacocoXmlReport(xmlContent): Q.Promise<CodeCoverageSummary> {

        this.command.info("parseJacocoXmlReport: Parsing summary file.");
        var defer = Q.defer<CodeCoverageSummary>();
        if (!xmlContent.report || !xmlContent.report.at(0) || !xmlContent.report.at(0).counter) {
            return null;
        }
        try {
            var coverage = new CodeCoverageSummary();
            var reportNode = xmlContent.report.at(0);

            var nodeLength = reportNode.counter.count();
            var coverageStats = [];
            for (var i = 0; i < nodeLength; i++) {
                var counterNode = reportNode.counter.at(i);
                var attributes = counterNode.attributes();
                if (attributes && attributes.type && attributes.covered && attributes.missed) {
                    var total = Number(attributes.covered) + Number(attributes.missed) ;
                    this.command.info(attributes.type + " : "+ attributes.covered + "/" + total + " covered.");
                    var coverageStat = SummaryReaderUtilities.getCodeCoverageStatistics(attributes.type, attributes.covered, total, attributes.type);
                    coverageStats.push(coverageStat);
                }
            }
            coverage.addResults(coverageStats);
        }
        catch (error) {
            this.command.warning("parseJacocoXmlReport: Error occured while parsing summary file. Error: " + error);
            defer.reject(error);
        }

        defer.resolve(coverage);
        return defer.promise;
    }
}

export class CoberturaSummaryReader implements ccp.ICodeCoverageReader {

    public command: cm.ITaskCommand;

    constructor(command: cm.ITaskCommand) {
        this.command = command;
    }

    public getCodeCoverageSummary(summaryFilePath: string): Q.Promise<testifm.CodeCoverageData> {
        var defer = Q.defer<testifm.CodeCoverageData>();
        var _this = this;

        SummaryReaderUtilities.getXmlContent(summaryFilePath).then(function(xmlContents) {
            _this.parseCoberturaXmlReport(xmlContents).then(function(codeCoverageSummary) {
                defer.resolve(SummaryReaderUtilities.getCodeCoverageData(codeCoverageSummary));
            })
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    private parseCoberturaXmlReport(xmlContent): Q.Promise<CodeCoverageSummary> {

        this.command.info("parseCoberturaXmlReport: Parsing summary file.");
        var defer = Q.defer<CodeCoverageSummary>();

        if (!xmlContent.coverage || !xmlContent.coverage.at(0) || !xmlContent.coverage.at(0).attributes()) {
            return null;
        }

        var coverageStats = [];
        var coverage = new CodeCoverageSummary();
        try {
            var coverageNode = xmlContent.coverage.at(0);
            var attributes = coverageNode.attributes();

            var linesTotal = attributes['lines-valid'];
            var linesCovered = attributes['lines-covered'];
            var branchesCovered = attributes['branches-covered'];
            var branchesTotal = attributes['branches-valid'];

            if (linesTotal && linesCovered) {
                this.command.info("Lines : "+ linesCovered + "/" + linesTotal + " covered.");
                var coverageStat = SummaryReaderUtilities.getCodeCoverageStatistics("Lines", linesCovered, linesTotal, "line");
                coverageStats.push(coverageStat);
            }

            if (branchesCovered && branchesTotal) {
                this.command.info("Branches : "+ branchesCovered + "/" + branchesTotal + " covered.");
                var coverageStat = SummaryReaderUtilities.getCodeCoverageStatistics("Branches", branchesCovered, branchesTotal, "branch");
                coverageStats.push(coverageStat);
            }

            coverage.addResults(coverageStats);
        }
        catch (error) {
            this.command.warning("parseCoberturaXmlReport: Error occured while parsing summary file. Error: " + error);
            defer.reject(error);
        }

        defer.resolve(coverage);
        return defer.promise;
    }
}

export class SummaryReaderUtilities {

    public static getXmlContent(summaryFile: string): Q.Promise<any> {
        var defer = Q.defer();

        utilities.readFileContents(summaryFile, "utf-8").then(function(contents) {
            xmlreader.read(contents, function(err, res) {
                if (err) {
                    this.command.warning("getXmlContent: Error occured while reading xml file. file : '" + summaryFile + "' Error: " + err);
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
            this.command.warning("getXmlContent: Error occured while reading xml file. file : '" + summaryFile + "' Error: " + err);
            defer.reject(err);
        });

        return defer.promise;
    }

    public static getCodeCoverageStatistics(label: string, covered: number, total: number, priorityTag: string): testifm.CodeCoverageStatistics {
        var coverageStat: testifm.CodeCoverageStatistics = <testifm.CodeCoverageStatistics>{
            label: label,
            covered: covered,
            total: total,
            position: SummaryReaderUtilities.getCoveragePriorityOrder(priorityTag)
        }
        return coverageStat;
    }

    public static getCodeCoverageData(codeCoverageSummary: CodeCoverageSummary): testifm.CodeCoverageData {
        if (!codeCoverageSummary) {
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