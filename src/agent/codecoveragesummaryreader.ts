import ifm = require('./interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import ccp = require('./codecoveragepublisher');
import utilities = require('./utilities');
import cm = require('./common');

var fs = require('fs');
var path = require("path");
var xmlreader = require('xmlreader');
var Q = require('q');

export class CodeCoverageSummary {
    results: testifm.CodeCoverageStatistics[];

    constructor() {
        this.results = [];
    }

    addResults(res) {
        this.results = this.results.concat(res);
    }
}

export class SummaryReader {
    constructor() {
    }

    public readSummaryFile(summaryFile: string): Q.Promise<string> {
        var defer = Q.defer();

        utilities.readFileContents(summaryFile, "utf-8").then(function(contents) {
            var xmlContent = contents.replace("\ufeff", ""); //replace BOM if exists to avoid xml read error
            defer.resolve(xmlContent);
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }
}

export class JacocoSummaryReader extends SummaryReader implements ccp.ICodeCoverageReader {
    public getCodeCoverageSummary(summaryFile: string): Q.Promise<testifm.CodeCoverageData> {
        var defer = Q.defer();

        this.readSummaryFile(summaryFile).then(function(xmlContent) {
            var codeCoverageSummary = this.readDataFromNodes(xmlContent);
            var coverageData: testifm.CodeCoverageData = <testifm.CodeCoverageData>{
                coverageStats: codeCoverageSummary
            }

            defer.resolve(coverageData);
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    private readDataFromNodes(xmlContent: string): Q.Promise<CodeCoverageSummary> {
        var defer = Q.defer();

        xmlreader.read(xmlContent, function(err, res) {
            if (err) {
                defer.reject(err);
            }
            else {
                try {
                    defer.resolve(this.parseJacocoXmlReport(res));
                }
                catch (ex) {
                    defer.reject(err);
                }
            }
        });

        return defer.promise;
    }

    private getCoveragePriorityOrder(label: string): Number {
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

    private parseJacocoXmlReport(res): CodeCoverageSummary {
        if (!res.report || res.report.at(0)) {
            return null;
        }
        var coverage = new CodeCoverageSummary();
        var reportNode = res.report.at(0);

        var counterNodeList = reportNode.counter.count();
        var coverageStats = []
        for (var i = 0; i < counterNodeList; i++) {
            var counterNode = counterNodeList.at(i);

            var coverageStat: testifm.CodeCoverageStatistics = <testifm.CodeCoverageStatistics>{
                label: counterNode.attributes().type,
                covered: counterNode.attributes().covered,
                total: Number(counterNode.attributes().covered) + Number(counterNode.attributes().missed),
                position: this.getCoveragePriorityOrder(counterNode.attributes().type)
            }

            coverageStats.concat(coverageStat);
        }
        coverage.addResults(coverageStats);

        return coverage;
    }

}