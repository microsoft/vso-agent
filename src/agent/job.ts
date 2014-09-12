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

/// <reference path="./definitions/async.d.ts"/>

import async = require('async');
import ctxm = require('./context');
import dm = require('./diagnostics');
import fs = require('fs');
import ifm = require('./api/interfaces');
import lm = require('./logging');
import path = require('path');
import plgm = require('./plugins');
import tm = require('./tracing');

var shell = require('shelljs');

var trace: tm.Tracing;

//
// TODO: fix this for context API changes
//       get compiling
//       add more tracing
//       discuss ordering on log creation, associating timeline with logid
//
export class JobRunner {
	constructor(context: ctxm.AgentContext) {
		this.context = context;
		trace = new tm.Tracing(__filename, context);
	}

	private context: ctxm.AgentContext;
	private job: ifm.JobRequestMessage;

	public setVariables(job: ifm.JobRequestMessage) {
		trace.enter('setVariables');
		trace.state('variables', job.environment.variables);

        var workFolder = this.context.config.settings.workFolder;
        if (!workFolder.startsWith('/')) {
            workFolder = path.join(__dirname, this.context.config.settings.workFolder);
        }

		var sys = job.environment.variables['sys'];
		var collId = job.environment.variables['sys.collectionId'];
		var defId = job.environment.variables['sys.definitionId'];

		var workingFolder = path.join(workFolder, sys, collId, defId);
		job.environment.variables['sys.workFolder'] = workFolder;
		job.environment.variables['sys.workingFolder'] = workingFolder;

		trace.state('variables', job.environment.variables);
	}

	private _replaceTaskInputVars(job: ifm.JobRequestMessage) {
		trace.enter('replaceTaskInputVars');

		// replace variables in inputs
		if (job.environment.variables) {
			job.tasks.forEach(function(task) {
				trace.write(task.name);
				for (var key in task.inputs){
					task.inputs[key] = task.inputs[key].replaceVars(job.environment.variables);
				}
			});
		}
		trace.state('tasks', job.tasks);
	}

	public run(jobCtx: ctxm.JobContext, complete: (err:any, result: ifm.TaskResult) => void) {
		this.job = jobCtx.job;
		var ag = this.context;
		trace.enter('run');

		this._replaceTaskInputVars(this.job);

		var _this: JobRunner = this;

		// prepare (might download) up to 5 tasks in parallel and then run tasks seuentially
		ag.status('Preparing Tasks');
		async.forEachLimit(this.job.tasks, 5, 
			function(pTask, callback){
				_this.prepareTask(jobCtx, pTask, callback);
			}, 
			function(err){
		        if (err) {
		            complete(err, ifm.TaskResult.Failed);
		            return;
		        }
		        			
				ag.info('Task preparations complete.');

				// TODO: replace build with sender id once confirm how sent
				plgm.load('build', ag, (err:any, plugins:any) => {
					if (err) {
						complete(err, ifm.TaskResult.Failed);
						return;
					}

					//
					// Write out plug-ins and tasks we are about to run.
					// Create timeline entries for each in Pending state
					//
					ag.info('beforeJob Plugins:')
					plugins['beforeJob'].forEach(function(plugin) {
						ag.info(plugin.pluginName() + ":" + plugin.beforeId);
						jobCtx.registerPendingTask(plugin.beforeId, plugin.pluginName());
					});

					ag.info('tasks:')
					jobCtx.job.tasks.forEach(function(task) {
						ag.info(task.name + ":" + task.id);
						jobCtx.registerPendingTask(task.instanceId, task.name);
					});

					ag.info('afterJob Plugins:')
					plugins['afterJob'].forEach(function(plugin) {
						ag.info(plugin.name + ":" + plugin.afterId);
						jobCtx.registerPendingTask(plugin.afterId, plugin.pluginName());
					});

					ag.info('working: ' + jobCtx.workingFolder);
					shell.mkdir('-p', jobCtx.workingFolder);
					shell.cd(jobCtx.workingFolder);

					var jobSuccess = true;
					async.series([
							function(done) {
								ag.info('Setting job to in progress');
								jobCtx.setJobInProgress();
								done(err);
							},
							function(done) {
								ag.info('Running beforeJob Plugins ...');
								plgm.beforeJob(plugins, jobCtx, ag, function(err, success) {
									ag.info('Finished running beforeJob plugins');
									trace.state('variables after plugins:', _this.job.environment.variables);

									// plugins can contribute to vars so replace again
									_this._replaceTaskInputVars(_this.job);

									jobSuccess = !err && success;
									if (err) {
										ag.error(err);
									}
									done(err);
								})
							},
							function(done) {
								// if prepare plugins fail, we should not run tasks (getting code failed etc...)
								if (!jobSuccess) {
									done(null);
								}

								ag.info('Running Tasks ...');
								_this.runTasks(jobCtx, (err: any, success: boolean) => {
									ag.info('Finished running tasks');
									jobSuccess = !err && success;
									if (err) {
										ag.error(err);
									}

									done(null);
								});
							},
							function(done) {
								ag.info('Running afterJob Plugins ...');
								plgm.afterJob(plugins, jobCtx, ag, jobSuccess, function(err, success) {
									ag.info('Finished running afterJob plugins');
									jobSuccess = !err && success;
									if (err) {
										ag.error(err);
									}									
									done(err);
								});
							}			
						], 
						function(err) {
							var jobResult = jobSuccess ? ifm.TaskResult.Succeeded : ifm.TaskResult.Failed;
							if (err) {
								jobResult = ifm.TaskResult.Failed; 
							}

							complete(err, jobResult);
						});
				});

			})
	}

	private runTasks(jobCtx: ctxm.JobContext, callback: (err:any, success:boolean) => void): void {
		var job: ifm.JobRequestMessage = jobCtx.job;
		var ag = this.context;
		var success = true;
		var _this: JobRunner = this;

		async.forEachSeries(job.tasks,
			function(item: ifm.TaskInstance, done: (err:any) => void){

				jobCtx.writeConsoleSection('Running ' + item.name);
				var taskCtx: ctxm.TaskContext = new ctxm.TaskContext(jobCtx.jobInfo, 
					                                                 item.instanceId,
					                                                 jobCtx.feedback, 
					                                                 ag);

				taskCtx.on('message', function(message) {
					jobCtx.feedback.queueConsoleLine(message);
				});

				shell.cd(taskCtx.workingFolder);
				jobCtx.setTaskStarted(item.instanceId, item.name);
				_this.runTask(item, taskCtx, function(err) {

					var taskResult: ifm.TaskResult = ifm.TaskResult.Succeeded;
					if (err || taskCtx.hasErrors) {
						success = false;
						taskResult = ifm.TaskResult.Failed;
					}
					jobCtx.setTaskResult(item.instanceId, item.name, taskResult);

					taskCtx.end();
					done(err);
				});
			}, function(err) {
				ag.info('Done running tasks.');

				if (err) {
	                ag.error(err.message);
	                callback(err, success);
	                return;		                
				}
				
				callback(null, success);
			});		
	}

	private taskScripts = {};

	private prepareTask(ctx: ctxm.JobContext, task: ifm.TaskInstance, callback) {
		var ag = this.context;

		var taskPath = path.join(ctx.workFolder, 'tasks', task.name, task.version);

		ag.info('preparing task ' + task.name);

		var taskJsonPath = path.join(taskPath, 'task.json');
		var taskNodeJsonPath = path.join(taskPath, 'task-node.json');

		// TODO (bryanmac): support downloading - check if exists
		var _this = this;
		fs.readFile(taskJsonPath, 'utf8', function (err, data) {
			if (err) {
				callback(err);
				return;
			}

			// TODO: task metadata should be typed
			try {
				// ensure valid metadata - not needed for agent to run
				JSON.parse(data);
			}
			catch (e) {
				callback(new Error('Invalid metadata @ ' + taskJsonPath));
				return;
			}

			fs.readFile(taskNodeJsonPath, 'utf8', function (err, data) {
				if (err) {
					callback(err);
					return;
				}

				try {
					var taskExecution = JSON.parse(data);
					var taskScript = taskExecution.task;
					_this.taskScripts[task.id] = path.join(taskPath, taskScript);					
				}
				catch (e) {
					callback(new Error('Invalid metadata @ ' + taskNodeJsonPath));
					return;
				}

				callback();			
			});
		});
	}

	private runTask(task: ifm.TaskInstance, ctx: ctxm.TaskContext, callback) {
		var ag = this.context;

		ag.status('Task: ' + task.name);

		for (var key in task.inputs){
			ctx.info(key + ': ' + task.inputs[key]);
		}
		ctx.info('');

		ctx.inputs = task.inputs;

		var taskScript = this.taskScripts[task.id];
		var ext = path.extname(taskScript).slice(1);
		var handler = require('./handlers/' + ext);
		ag.info('running ' + taskScript);
		handler.runTask(taskScript, ctx, callback);
	}	
}
