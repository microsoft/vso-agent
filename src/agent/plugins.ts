// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var fs = require('fs');
var path = require('path');
var async = require('async');
var uuid = require('node-uuid');
var shell = require('shelljs');

import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import cm = require('./common');
import ctxm = require('./context');
import tm = require('./tracing');

var trace: tm.Tracing;

var isFunction = function (func) {
    return typeof func === 'function';
}

export interface IPlugin {
    beforeId?: string;
    afterId?: string;
    pluginName(): string;
    pluginTitle(): string;
    shouldRun(jobSuccess: boolean, executionContext: cm.IExecutionContext): boolean;
    beforeJob?(executionContext: cm.IExecutionContext, callback: (err?: any) => void): void;
    afterJob?(executionContext: cm.IExecutionContext, callback: (err?: any) => void): void;
}

export function load(pluginType, outputChannel: cm.IOutputChannel, executionContext: cm.IExecutionContext, callback) {
    var plugins = {};
    plugins['beforeJob'] = [];
    plugins['afterJob'] = [];

    var folder = path.join(__dirname, 'plugins', pluginType);

    fs.readdir(folder, function (err, files) {
        if (err) {
            callback(err);
            return;
        }

        async.forEachSeries(files,
            function (item, done) {
                var pluginPath = path.join(folder, item);
                outputChannel.info('inspecting ' + pluginPath);
                if (path.extname(pluginPath) === '.js') {
                    try {
                        var plugin = require(pluginPath);

                        // ensure plugin - has name and title functions
                        if (isFunction(plugin.pluginName) && isFunction(plugin.pluginTitle)) {
                            outputChannel.info('Found plugin: ' + plugin.pluginName() + ' @ ' + pluginPath);

                            if (isFunction(plugin.beforeJob)) {
                                plugin.beforeId = uuid.v1();
                                plugins['beforeJob'].push(plugin);
                            }

                            // one plugin may have implementations of multiple options
                            if (isFunction(plugin.afterJobPlugins)) {
                                plugin.afterJobPlugins(executionContext).forEach((option: IPlugin) => {
                                    option.afterId = uuid.v1();
                                    plugins['afterJob'].push(option);
                                });
                            }
                        }
                    }
                    catch (ex) {
                        console.error(ex);
                    }
                }

                done();
            },
            function (err) {
                callback(err, plugins);
            });
    })
}

export function beforeJob(plugins: IPlugin[], executionContext: cm.IExecutionContext, hostContext: ctxm.HostContext, callback: (err: any, success: boolean) => void): void {
    trace = new tm.Tracing(__filename, hostContext);
    trace.enter('beforeJob plugins');

    async.forEachSeries(plugins['beforeJob'],
        function (plugin: IPlugin, done) {
            hostContext.info('Running beforeJob for : ' + plugin.pluginName() + ', ' + plugin.beforeId);

            executionContext.writeConsoleSection('Running ' + plugin.pluginName());

            var logDescr = 'Plugin beforeJob:' + plugin.pluginName();
            
            // create a new execution context with the before-job timeline record id
            var pluginContext = new ctxm.ExecutionContext(executionContext.jobInfo, executionContext.authHandler, plugin.beforeId, executionContext.service, hostContext);
            
            pluginContext.on('message', function (message) {
                pluginContext.service.queueConsoleLine(message);
            });

            pluginContext.setTaskStarted(plugin.pluginName());

            plugin.beforeJob(pluginContext, function (err) {
                if (err) {
                    pluginContext.setTaskResult(plugin.pluginName(), agentifm.TaskResult.Failed);
                    pluginContext.error(err);
                    pluginContext.end();
                    done(err);
                }
                else {
                    pluginContext.setTaskResult(plugin.pluginName(), agentifm.TaskResult.Succeeded);
                    hostContext.info('Done beforeJob for : ' + plugin.pluginName());
                    pluginContext.end();
                    done(null);
                }
            });
        },
        function (err) {
            callback(err, !err);
        });
}

export function afterJob(plugins: IPlugin[], executionContext: cm.IExecutionContext, hostContext: ctxm.HostContext, jobSuccess: boolean, callback: (err: any, success: boolean) => void): void {
    trace = new tm.Tracing(__filename, hostContext);
    trace.enter('afterJob plugins');

    async.forEachSeries(plugins['afterJob'],
        function (plugin: IPlugin, done) {
            trace.write('afterJob plugin: ' + plugin.pluginName());

            if (!plugin.shouldRun(jobSuccess, executionContext)) {
                trace.write('should not run');
                done();
                return;
            }

            hostContext.info('Running afterJob for : ' + plugin.pluginName());

            executionContext.writeConsoleSection('Running ' + plugin.pluginName());
            var logDescr = 'Plugin afterJob:' + plugin.pluginName();
            
            // create a new execution context with the before-job timeline record id
            var pluginContext = new ctxm.ExecutionContext(executionContext.jobInfo, executionContext.authHandler, plugin.afterId, executionContext.service, hostContext);
            
            pluginContext.on('message', function (message) {
                pluginContext.service.queueConsoleLine(message);
            });

            pluginContext.setTaskStarted(plugin.pluginName());
            plugin.afterJob(pluginContext, function (err) {
                if (err) {
                    pluginContext.setTaskResult(plugin.pluginName(), agentifm.TaskResult.Failed);
                    pluginContext.error(err);
                    pluginContext.end();
                    done(err);
                }
                else {
                    pluginContext.setTaskResult(plugin.pluginName(), agentifm.TaskResult.Succeeded);
                    hostContext.info('Done afterJob for : ' + plugin.pluginName());
                    pluginContext.end();
                    done(null);
                }
            });
        },
        function (err) {
            callback(err, !err);
        });
}
