// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import ccifm = require('vso-node-api/interfaces/CodeCoverageInterfaces');
import ctxm = require('./context');
import cm = require('./common');
import utilities = require('./utilities');
import Q = require('q');
import ccc = require('./codecoverageconstants');

var str = require('string');
var shell = require('shelljs');
var path = require('path');

/* Code Coverage enabler for different type of build tools and code coverage tools*/
export abstract class CodeCoverageEnabler implements ICodeCoverageEnabler {
    constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
        this.executionContext = executionContext;
        this.command = command;
    }

    protected executionContext: cm.IExecutionContext;
    protected command: cm.ITaskCommand;

    abstract enableCodeCoverage(ccProps: ccifm.CodeCoverageProperties): Q.Promise<boolean>;

    //-----------------------------------------------------
    // Convert the VSTS specific filter to Code Coverage Tool specific filter pattern
    // - extractFilters: string  - classFilter
    //-----------------------------------------------------    
    protected extractFilters(classFilter: string) {
        var includeFilter = "";
        var excludeFilter = "";
        var _this = this;

        if (utilities.isNullOrWhitespace(classFilter)) {
            return {
                includeFilter: includeFilter,
                excludeFilter: excludeFilter
            };
        }

        var inputFilters = classFilter.split(",");
        inputFilters.forEach(inputFilter => {
            if (utilities.isNullOrWhitespace(inputFilter) || inputFilter.length < 2) {
                throw new Error("Invalid class filter " + inputFilter);
            }

            switch (inputFilter.charAt(0)) {
                case '+':
                    includeFilter += inputFilter.substr(1);
                    break;
                case '-':
                    excludeFilter += inputFilter.substr(1);
                    break;
                default:
                    throw new Error("Invalid class filter " + inputFilter);
            }
        });

        return {
            includeFilter: includeFilter,
            excludeFilter: excludeFilter
        };
    }
}

export class JacocoGradleCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Jacoco Gradle Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: ccifm.CodeCoverageProperties): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();
        var _this = this;

        var buildFile = ccProps.buildFile;
        var classFilter = ccProps.classFilter;
        var isMultiModule = ccProps.isMultiModule;
        var classFileDirs = ccProps.classFileDirs;
        var reportDir = ccProps.reportDir;
        var codeCoveragePluginData = null;

        var filter = _this.extractFilters(classFilter);
        var jacocoExclude = _this.applyJacocoFilterPattern(filter.excludeFilter);
        var jacocoInclude = _this.applyJacocoFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.jacocoGradleMultiModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir);
        } else {
            codeCoveragePluginData = ccc.jacocoGradleSingleModuleEnable(jacocoExclude.join(","), jacocoInclude.join(","), classFileDirs, reportDir);
        }

        if (codeCoveragePluginData) {
            _this.executionContext.info("Code Coverage data will be appeneded to build file: " + buildFile);
            utilities.appendTextToFileSync(buildFile, codeCoveragePluginData);
            _this.executionContext.info("Appended code coverage data");

            defer.resolve(true);
        } else {
            _this.executionContext.warning("Unable to append code coverage data");
            defer.resolve(false);
        }

        return defer.promise;
    }

    private applyJacocoFilterPattern(filter: string): string[] {
        var jacocoFilter = [];
        var _this = this;

        if (!utilities.isNullOrWhitespace(filter)) {
            str(utilities.trimToEmptyString(filter)).replaceAll(".", "/").split(":").forEach(exFilter => {
                if (exFilter) {
                    jacocoFilter.push(str(exFilter).endsWith("*") ? ("'" + exFilter + "/**'") : ("'" + exFilter + ".class'"));
                }
            });
        }

        return jacocoFilter;
    }
}

export class JacocoMavenCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Jacoco Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: ccifm.CodeCoverageProperties): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();


        defer.resolve(true);
        return defer.promise;
    }
}

export class JacocoAntCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Jacoco Ant Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: ccifm.CodeCoverageProperties): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();


        defer.resolve(true);
        return defer.promise;
    }
}

export class CoberturaGradleCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Gradle Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: ccifm.CodeCoverageProperties): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();
        var _this = this;

        var buildFile = ccProps.buildFile;
        var classFilter = ccProps.classFilter;
        var isMultiModule = ccProps.isMultiModule;
        var classFileDirs = ccProps.classFileDirs;
        var reportDir = ccProps.reportDir;
        var codeCoveragePluginData = null;

        var filter = _this.extractFilters(classFilter);
        var cobExclude = _this.applyCoberturaFilterPattern(filter.excludeFilter);
        var cobInclude = _this.applyCoberturaFilterPattern(filter.includeFilter);

        if (isMultiModule) {
            codeCoveragePluginData = ccc.coberturaGradleMultiModuleEnable(cobExclude.join(","), cobInclude.join(","), classFileDirs, null, reportDir);
        } else {
            codeCoveragePluginData = ccc.coberturaGradleSingleModuleEnable(cobExclude.join(","), cobInclude.join(","), classFileDirs, null, reportDir);
        }

        if (codeCoveragePluginData) {
            _this.executionContext.info("Code Coverage data will be appeneded to build file: " + buildFile);
            utilities.insertTextToFileSync(buildFile, ccc.coberturaGradleBuildScript, codeCoveragePluginData);
            _this.executionContext.info("Appended code coverage data");
            defer.resolve(true);
        } else {
            _this.executionContext.warning("Unable to append code coverage data");
            defer.resolve(false);
        }

        return defer.promise;
    }

    private applyCoberturaFilterPattern(filter: string): string[] {
        var coberturaFilter = [];
        var _this = this;

        if (!utilities.isNullOrWhitespace(filter)) {
            utilities.trimToEmptyString(filter).split(":").forEach(exFilter => {
                if (exFilter) {
                    coberturaFilter.push(str(exFilter).endsWith("*") ? ("'.*" + utilities.trimEnd(exFilter, "*") + ".*'") : ("'.*" + exFilter + "'"));
                }
            });
        }

        return coberturaFilter;
    }
}

export class CoberturaMavenCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Maven Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: ccifm.CodeCoverageProperties): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();


        defer.resolve(true);
        return defer.promise;
    }
}

export class CoberturaAntCodeCoverageEnabler extends CodeCoverageEnabler {
    //-----------------------------------------------------
    // Enable code coverage for Cobertura Ant Builds
    // - enableCodeCoverage: CodeCoverageProperties  - ccProps
    //-----------------------------------------------------    
    public enableCodeCoverage(ccProps: ccifm.CodeCoverageProperties): Q.Promise<boolean> {
        var defer = Q.defer<boolean>();


        defer.resolve(true);
        return defer.promise;
    }
}

//-----------------------------------------------------
// Interface to be implemented by all code coverage enablers 
//-----------------------------------------------------
export interface ICodeCoverageEnabler {
    //enable code coverage for the given build tool and code coverage tool
    enableCodeCoverage(ccProps: ccifm.CodeCoverageProperties): Q.Promise<boolean>;
}