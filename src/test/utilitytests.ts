// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import ccp = require('../agent/utilities');
import testifm = require('vso-node-api/interfaces/TestInterfaces');
import path = require('path');
import fs = require('fs');
var shell = require('shelljs');

var file1 = path.resolve(__dirname, './testresults/xunitresults.xml');
var file2 = path.resolve(__dirname, './codecoveragefiles/jacoco.xml');

describe('UtiltyTests', function() {
    it('archiveFiles : Archive files', function(done) {
        this.timeout(2000);

        ccp.archiveFiles([file1, file2], "test.zip").then(function(archive) {
            var stats = fs.statSync(archive);
            var fileSizeInBytes = stats["size"];
            assert(fileSizeInBytes > 0);
            done();
        }).fail(function(err) {
            assert(err);
        });
    })

    it('toTitleCase : input string with spaces', function(done) {
        this.timeout(2000);

        var titleCaseString = ccp.toTitleCase("tesT sTrIng");
        assert(titleCaseString == "Test String");
        done();
    })

    it('toTitleCase : input string with special characters', function(done) {
        this.timeout(2000);

        var titleCaseString = ccp.toTitleCase("t%~s1T s$rIng");
        assert(titleCaseString == "T%~s1t S$ring");
        done();
    })

    it('toTitleCase : input string without spaces', function(done) {
        this.timeout(2000);

        var titleCaseString = ccp.toTitleCase("testString");
        assert(titleCaseString == "Teststring");
        done();
    })

    it('toTitleCase : input string empty', function(done) {
        this.timeout(2000);

        var titleCaseString = ccp.toTitleCase("");
        assert(titleCaseString == "");
        done();
    })

    it('toTitleCase : input string null', function(done) {
        this.timeout(2000);

        var titleCaseString = ccp.toTitleCase(null);
        assert(titleCaseString == null);
        done();
    })
});	
