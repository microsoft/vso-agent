// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/mocha.d.ts"/>

import assert = require('assert');
import util = require('../agent/utilities');
import path = require('path');
import fs = require('fs');

var file1 = path.resolve(__dirname, './testresults/xunitresults.xml');
var file2 = path.resolve(__dirname, './codecoveragefiles/jacoco.xml');

describe('UtiltyTests', function() {
    it('archiveFiles : Archive files', function(done) {
        this.timeout(2000);

        util.archiveFiles([file1, file2], "test.zip").then(function(archive) {
            var stats = fs.statSync(archive);
            var fileSizeInBytes = stats["size"];
            assert(fileSizeInBytes > 0);
            done();
        }).fail(function(err) {
            assert(err);
        });
    })

    it('Test TrimEnd functionality', function(done) {
        this.timeout(2000);

        assert(util.trimEnd("Test. data.", ".") == "Test. data");
        assert(util.trimEnd("Test. data.", ",") == "Test. data.");
        assert(util.trimEnd("Test. data.", null) == "Test. data.");
        assert(util.trimEnd("", ".") == "");
        done();
    })

    it('Test Insert File Content functionality', function(done) {
        this.timeout(2000);
        var prependText = "This is Prepend Text";
        var appendText = "This is Append Text";

        util.insertTextToFileSync(file2, prependText, appendText);

        fs.readFile(file2, 'utf-8', function(err, data) {
            assert(data.indexOf(prependText) != -1);
            assert(data.indexOf(appendText) != -1);
            assert(data.indexOf(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`) != -1);
            assert(data.indexOf(`</report>`) != -1);
            done();
        });
    })
});	
