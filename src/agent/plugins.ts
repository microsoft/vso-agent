// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

var fs = require('fs');
var path = require('path');
var async = require('async');
var uuid = require('node-uuid');
var shell = require('shelljs');

import ifm = require('./api/interfaces');
import ctxm = require('./context');
import tm = require('./tracing');

var trace: tm.Tracing;

var isFunction = function(func) {
	return typeof func === 'function';
}

export function load(pluginType, ctx: ctxm.AgentContext, callback) {
	var plugins = {};
	plugins['beforeJob'] = [];
	plugins['afterJob'] = [];

	var folder = path.join(__dirname, 'plugins', pluginType);

	fs.readdir(folder, function(err, files) {
		if (err) {
			callback(err);
			return;
		}

		async.forEachSeries(files, 
			function(item, done) {
				var pluginPath = path.join(folder, item);
				ctx.info('inspecting ' + pluginPath);
				if (path.extname(pluginPath) === '.js') {
					try {
						var plugin = require(pluginPath);

						// ensure plugin - has name and title functions
						if (isFunction(plugin.pluginName) && isFunction(plugin.pluginTitle)) {
							ctx.info('Found plugin: ' + plugin.pluginName() + ' @ ' + pluginPath);

							if (isFunction(plugin.beforeJob)) {
								plugin.beforeId = uuid.v1();
								plugins['beforeJob'].push(plugin);
							}

							if (isFunction(plugin.afterJob)) {
								plugin.afterId = uuid.v1();
								plugins['afterJob'].push(plugin);
							}
						}
					}
					catch (ex) {
						console.error(ex);
					}
				}

				done();
			}, 
			function(err) {
				callback(err, plugins);
			});
	})
}

export function beforeJob(plugins, ctx: ctxm.JobContext, agentCtx: ctxm.AgentContext, callback: (err: any, success: boolean) => void): void {
	trace = new tm.Tracing(__filename, agentCtx);
	trace.enter('beforeJob');

	async.forEachSeries(plugins['beforeJob'], 
		function(plugin, done) {
			ctx.info('Running beforeJob for : ' + plugin.pluginName() + ', ' + plugin.beforeId);

			ctx.writeConsoleSection('Running ' + plugin.pluginName());

			var logDescr = 'Plugin beforeJob:' + plugin.pluginName();
			var pluginCtx: ctxm.PluginContext = new ctxm.PluginContext(ctx.job, 
				                                                       plugin.beforeId,
				                                                       ctx.feedback, 
				                                                       agentCtx);
			
			pluginCtx.on('message', function(message) {
				ctx.feedback.queueConsoleLine(message);
			});
			
			shell.cd(pluginCtx.workingFolder);
			ctx.setTaskStarted(plugin.beforeId, plugin.pluginName());

			plugin.beforeJob(pluginCtx, function(err) {
				if (err) {
					ctx.setTaskResult(plugin.beforeId, plugin.pluginName(), ifm.TaskResult.Failed);
					ctx.error(err);
					pluginCtx.end();
					done(err);
					return;
				}

				ctx.setTaskResult(plugin.beforeId, plugin.pluginName(), ifm.TaskResult.Succeeded);
				ctx.info('Done beforeJob for : ' + plugin.pluginName());
				pluginCtx.end();
				done(null);	
			});				
		}, 
		function(err) {
			callback(err, !err);
		});
}

export function afterJob(plugins, ctx: ctxm.JobContext, agentCtx: ctxm.AgentContext, tasksFail: Boolean, callback: (err: any, success: boolean) => void): void {
	async.forEachSeries(plugins['afterJob'], 
		function(plugin, done) {
			ctx.info('Running afterJob for : ' + plugin.pluginName());
			var alwaysRun = plugin.alwaysRunAfter();
			ctx.info('alwaysRun : ' + alwaysRun);

			if (tasksFail && !alwaysRun) {
				done();
			}

			ctx.writeConsoleSection('Running ' + plugin.pluginName());
			var logDescr = 'Plugin afterJob:' + plugin.pluginName();
			var pluginCtx: ctxm.PluginContext = new ctxm.PluginContext(ctx.job, 
				                                                       plugin.afterId, 
				                                                       ctx.feedback,
				                                                       agentCtx);
			pluginCtx.on('message', function(message) {
				ctx.feedback.queueConsoleLine(message);
			});

			shell.cd(pluginCtx.workingFolder);
			ctx.setTaskStarted(plugin.afterId, plugin.pluginName());
			plugin.afterJob(pluginCtx, function(err) {
				if (err) {
					ctx.setTaskResult(plugin.beforeId, plugin.pluginName(), ifm.TaskResult.Failed);
					ctx.error(err);
					pluginCtx.end();
					done(err);
					return;
				}

				ctx.setTaskResult(plugin.beforeId, plugin.pluginName(), ifm.TaskResult.Succeeded);
				ctx.info('Done afterJob for : ' + plugin.pluginName());
				pluginCtx.end();
				done(null);	
			});				
		}, 
		function(err) {
			callback(err, !err);
		});
}
