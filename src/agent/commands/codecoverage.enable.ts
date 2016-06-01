// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cm = require('../common');
import Q = require('q');
import ccifm = require('vso-node-api/interfaces/CodeCoverageInterfaces');
import ctxm = require('../context');
import fs = require('fs');
import utilities = require('../utilities');
import cce = require('../codecoverageenabler');

//-----------------------------------------------------
// Enable Code Coverage file for specified Build file 
// - CMD_PREFIX + "codecoverage.enable buildTool: "buildTool", ccTool: "ccTool"]" + buildFile
//-----------------------------------------------------

export function createAsyncCommand(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
    return new CodeCoverageEnableCommand(executionContext, command);
}

export class CodeCoverageEnableCommand implements cm.IAsyncCommand {
    constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
        this.command = command;
        this.executionContext = executionContext;
        this.description = "CodeCoverage.Enable async Command";
    }

    public command: cm.ITaskCommand;
    public executionContext: cm.IExecutionContext;
    public description: string;

    public runCommandAsync(): Q.Promise<any> {
        var defer = Q.defer();
        var _this = this;
        var isMultiModule = _this.command.properties["ismultimodule"] && _this.command.properties["ismultimodule"].toLowerCase() == 'true';

        var ccProps = <ccifm.CodeCoverageProperties>{
            codeCoverageTool: _this.command.properties["codecoveragetool"],
            buildTool: _this.command.properties["buildtool"],
            summaryFile: _this.command.properties["summaryfile"],
            isMultiModule: isMultiModule,
            buildFile: _this.command.properties["buildfile"],
            reportDir: _this.command.properties["reportdir"],
            classFileDirs: _this.command.properties["classfiledirs"],
            classFilter: _this.command.properties["classfilter"]
        };

        _this.command.debug("Code coverage properites: " + JSON.stringify(ccProps));

        try {
            _this.validateInputData(ccProps);
        } catch (err) {
            defer.reject(err);
            return defer.promise;
        }

        var ccEnabler: cce.ICodeCoverageEnabler;

        switch (ccProps.codeCoverageTool.trim().toLowerCase() + "_" + ccProps.buildTool.trim().toLowerCase()) {
            case "jacoco_gradle":
                ccEnabler = new cce.JacocoGradleCodeCoverageEnabler(_this.executionContext, _this.command);
                break;
            case "jacoco_maven":
                ccEnabler = new cce.JacocoMavenCodeCoverageEnabler(_this.executionContext, _this.command);
                break;
            case "jacoco_ant":
                ccEnabler = new cce.JacocoAntCodeCoverageEnabler(_this.executionContext, _this.command);
                break;
            case "cobertura_gradle":
                ccEnabler = new cce.CoberturaGradleCodeCoverageEnabler(_this.executionContext, _this.command);
                break;
            case "cobertura_maven":
                ccEnabler = new cce.CoberturaMavenCodeCoverageEnabler(_this.executionContext, _this.command);
                break;
            case "cobertura_ant":
                ccEnabler = new cce.CoberturaAntCodeCoverageEnabler(_this.executionContext, _this.command);
                break;
            default:
                var err = new Error("Code coverage tool '" + ccProps.codeCoverageTool + "' and build tool '" + ccProps.buildTool + "' is not supported.");
                defer.reject(err);
                return defer.promise;
        }

        ccEnabler.enableCodeCoverage(ccProps).then(function(response) {
            defer.resolve(response);
        }).fail(function(err) {
            defer.reject(err);
        });

        return defer.promise;
    }

    private validateInputData(ccProps: ccifm.CodeCoverageProperties) {
        if (!ccProps) {
            throw new Error("Code Coverage properties are not provided");
        }

        if (!ccProps.codeCoverageTool) {
            throw new Error("No code coverage tool is provided.");
        }

        if (!ccProps.buildTool) {
            throw new Error("No build tool is provided.");
        }

        if (!ccProps.summaryFile) {
            throw new Error("No code coverage summary file is provided.");
        }

        if (!ccProps.buildFile) {
            throw new Error("Build file is not provided.");
        }

        if (!ccProps.reportDir) {
            throw new Error("Report Directory is not provided.");
        }

        if (!ccProps.classFileDirs) {
            throw new Error("Class file directory is not provided.");
        }

        if (!utilities.isFileExists(ccProps.buildFile)) {
            throw new Error("Build file '" + ccProps.buildFile + "' doesnot exist or it is not a valid file.");
        }
    }
}