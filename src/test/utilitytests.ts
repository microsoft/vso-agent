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
});	
