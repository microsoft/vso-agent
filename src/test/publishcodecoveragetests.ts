// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import path = require('path');
import fm = require('./lib/feedback');
import tec = require('./lib/testExecutionContext');
import ccp = require('../agent/codecoveragepublisher');
import csr = require('../agent/codecoveragesummaryreader');
import cm = require('../agent/common');
import ifm = require('../agent/interfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import tc = require('./lib/testcommand');

var jobInf = require('./lib/testJobInfo');

describe('CodeCoveragePublisherTests', function() {

    var jacocoSummaryFile = path.resolve(__dirname, './codecoveragefiles/jacoco.xml');
    var coberturaSummaryFile = path.resolve(__dirname, './codecoveragefiles/cobertura.xml');

    var testExecutionContext;

    it('codecoverage.publish : publish jacoco summary successfully', function(done) {
        this.timeout(2000);
        
        var properties: { [name: string]: string } = {"summaryfile" : jacocoSummaryFile};
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties =properties;
        var jacocoSummaryReader = new csr.JacocoSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));

        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, jacocoSummaryReader);
        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(result);
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
            });
    })

    it('codecoverage.publish : publish cobertura summary successfully', function(done) {
        this.timeout(2000);
        
         var properties: { [name: string]: string } = {"summaryfile" : coberturaSummaryFile};
        var command: cm.ITaskCommand = new tc.TestCommand(null, null, null);
        command.properties =properties;
        var coberturaSummaryReader = new csr.CoberturaSummaryReader(command);
        testExecutionContext = new tec.TestExecutionContext(new jobInf.TestJobInfo({}));
        
        var codeCoveragePublisher = new ccp.CodeCoveragePublisher(testExecutionContext, command, coberturaSummaryReader);
        
        codeCoveragePublisher.publishCodeCoverageSummary().then(function(result) {
            assert(testExecutionContext.service.jobsCompletedSuccessfully(), 'CodeCoveragePublish Task Failed! Details : ' + testExecutionContext.service.getRecordsString());
            assert(result);
            done();
        },
            function(err) {
                assert(false, 'CodeCoveragePublish Task Failed! Details : ' + err.message);
            });
    })
});	
