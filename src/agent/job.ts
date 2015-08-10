// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/async.d.ts"/>

import async = require('async');
import ctxm = require('./context');
import dm = require('./diagnostics');
import fs = require('fs');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import lm = require('./logging');
import path = require('path');
import plgm = require('./plugins');
import taskm = require('./taskmanager');
import tm = require('./tracing');
import cm = require('./common');

var shell = require('shelljs');

// TODO: remove this hack in a couple of sprints.  Some tasks were not loading shelljs
//       and the issue was masked.  Fixing tasks now and then we will remove.
require('shelljs/global')

var trace: tm.Tracing;

//
// TODO: fix this for context API changes
//       get compiling
//       add more tracing
//       discuss ordering on log creation, associating timeline with logid
//
export class JobRunner {
    constructor(serviceContext: ctxm.ServiceContext, jobCtx: ctxm.JobContext) {
        this._serviceContext = serviceContext;
        trace = new tm.Tracing(__filename, serviceContext);
        trace.enter('JobRunner');
        this._jobContext = jobCtx;
        this._job = jobCtx.job;
    }

    private _serviceContext: ctxm.ServiceContext;
    private _jobContext: ctxm.JobContext;

    private _job: agentifm.JobRequestMessage;

    private _processVariables() {
        this._serviceContext.info('_processVariables');

        // replace variables in inputs
        var vars = this._job.environment.variables;
        if (vars) {
            // we don't want vars to be case sensitive
            var lowerVars = {};
            for (var varName in vars) {
                lowerVars[varName.toLowerCase()] = vars[varName];
            }

            this._job.tasks.forEach((task) => {
                trace.write(task.name);
                for (var key in task.inputs) {
                    if (task.inputs[key]) {
                        task.inputs[key] = task.inputs[key].replaceVars(lowerVars);    
                    }
                }
            });

            // set env vars
            for (var variable in vars) {
                var envVarName = variable.replace(".", "_").toUpperCase();
                process.env[envVarName] = vars[variable];
            }
            trace.state('variables', process.env);     
        }

        trace.state('tasks', this._job.tasks);
    }

    public run(complete: (err: any, result: agentifm.TaskResult) => void) {
        trace.enter('run');

        var serviceContext = this._serviceContext;
        this._processVariables();

        var _this: JobRunner = this;
        var jobCtx: ctxm.JobContext = this._jobContext;

        trace.write('Setting job to in progress');
        jobCtx.setJobInProgress();
        jobCtx.writeConsoleSection('Preparing tasks');

        serviceContext.info('Downloading required tasks');
        var taskManager = new taskm.TaskManager(serviceContext, jobCtx.authHandler);
        taskManager.ensureTasksExist(this._job.tasks).then(() => {
            // prepare (might download) up to 5 tasks in parallel and then run tasks seuentially
            serviceContext.info('Preparing Tasks');
            async.forEach(_this._job.tasks,
                function (pTask, callback) {
                    _this.prepareTask(pTask, callback);
                },
                function (err) {
                    if (err) {
                        trace.write('error preparing tasks');
                        complete(err, agentifm.TaskResult.Failed);
                        return;
                    }

                    serviceContext.info('Task preparations complete.');

                    // TODO: replace build with sender id once confirm how sent

                    serviceContext.info('loading plugins...');
                    var system = _this._job.environment.variables[cm.sysVars.system];
                    plgm.load(system, serviceContext, jobCtx, (err: any, plugins: any) => {
                        if (err) {
                            trace.write('error loading plugins');
                            complete(err, agentifm.TaskResult.Failed);
                            return;
                        }

                        //
                        // Write out plug-ins and tasks we are about to run.
                        // Create timeline entries for each in Pending state
                        //
                        var order = 1;
                        serviceContext.info('beforeJob Plugins:')
                        plugins['beforeJob'].forEach(function (plugin) {
                            serviceContext.info(plugin.pluginName() + ":" + plugin.beforeId);

                            jobCtx.registerPendingTask(plugin.beforeId, 
                                                       plugin.pluginTitle(), 
                                                       order++);
                        });

                        serviceContext.info('tasks:')
                        jobCtx.job.tasks.forEach(function (task) {
                            serviceContext.info(task.name + ":" + task.id);

                            jobCtx.registerPendingTask(task.instanceId, 
                                                       task.displayName, 
                                                       order++);
                        });

                        serviceContext.info('afterJob Plugins:')
                        plugins['afterJob'].forEach(function(plugin) {
                            serviceContext.info(plugin.pluginName() + ":" + plugin.afterId);

                            if (plugin.shouldRun(true, jobCtx)) {
                                serviceContext.info('shouldRun');

                                jobCtx.registerPendingTask(plugin.afterId, 
                                                           plugin.pluginTitle(), 
                                                           order++);    
                            }
                        });

                        serviceContext.info('buildDirectory: ' + jobCtx.buildDirectory);
                        shell.mkdir('-p', jobCtx.buildDirectory);
                        shell.cd(jobCtx.buildDirectory);
                        trace.write(process.cwd());

                        var jobResult: agentifm.TaskResult = agentifm.TaskResult.Succeeded;
                        async.series(
                            [
                                function (done) {
                                    serviceContext.info('Running beforeJob Plugins ...');

                                    plgm.beforeJob(plugins, jobCtx, serviceContext, function (err, success) {
                                        serviceContext.info('Finished running beforeJob plugins');
                                        trace.state('variables after plugins:', _this._job.environment.variables);

                                        // plugins can contribute to vars so replace again
                                        _this._processVariables();

                                        jobResult = !err && success ? agentifm.TaskResult.Succeeded : agentifm.TaskResult.Failed;
                                        trace.write('jobResult: ' + jobResult);

                                        // we always run afterJob plugins
                                        done(null);
                                    })
                                },
                                function (done) {
                                    // if prepare plugins fail, we should not run tasks (getting code failed etc...)
                                    if (jobResult == agentifm.TaskResult.Failed) {
                                        trace.write('skipping running tasks since prepare plugins failed.');
                                        done(null);
                                    }
                                    else {
                                        serviceContext.info('Running Tasks ...');
                                        _this.runTasks((err: any, result: agentifm.TaskResult) => {
                                            serviceContext.info('Finished running tasks');
                                            jobResult = result;
                                            trace.write('jobResult: ' + result);

                                            done(null);
                                        });
                                    }
                                },
                                function (done) {
                                    serviceContext.info('Running afterJob Plugins ...');

                                    plgm.afterJob(plugins, jobCtx, serviceContext, jobResult != agentifm.TaskResult.Failed, function (err, success) {
                                        serviceContext.info('Finished running afterJob plugins');
                                        trace.write('afterJob Success: ' + success);
                                        jobResult = !err && success ? jobResult : agentifm.TaskResult.Failed;
                                        trace.write('jobResult: ' + jobResult);

                                        done(err);
                                    });
                                }
                            ],
                            function (err) {
                                trace.write('jobResult: ' + jobResult);

                                if (err) {
                                    jobResult = agentifm.TaskResult.Failed;
                                }

                                complete(err, jobResult);
                            });
                    });

                });
        }, 
        (err: any) => {
            complete(err, ifm.TaskResult.Failed);
            return;
        });
    }

    private runTasks(callback: (err: any, jobResult: agentifm.TaskResult) => void): void {
        trace.enter('runTasks');

        var job: agentifm.JobRequestMessage = this._job;
        var serviceContext = this._serviceContext;
        var jobCtx: ctxm.JobContext = this._jobContext;

        var jobResult: agentifm.TaskResult = agentifm.TaskResult.Succeeded;
        var _this: JobRunner = this;

        trace.state('tasks', job.tasks);
        async.forEachSeries(job.tasks,
            function (item: agentifm.TaskInstance, done: (err: any) => void) {

                jobCtx.writeConsoleSection('Running ' + item.name);
                var taskCtx: ctxm.TaskContext = new ctxm.TaskContext(jobCtx.jobInfo,
                    jobCtx.authHandler,
                    item.instanceId,
                    jobCtx.service,
                    serviceContext);

                taskCtx.on('message', function (message) {
                    jobCtx.service.queueConsoleLine(message);
                });

                shell.cd(taskCtx.buildDirectory);
                jobCtx.setTaskStarted(item.instanceId, item.name);
                _this.runTask(item, taskCtx, (err) => {

                    var taskResult: agentifm.TaskResult = taskCtx.result;
                    if (err || taskResult == agentifm.TaskResult.Failed) {
                        if (item.continueOnError) {
                            taskResult = jobResult = agentifm.TaskResult.SucceededWithIssues;
                            err = null;
                        }
                        else {
                            taskResult = jobResult = agentifm.TaskResult.Failed;
                            err = new Error('Task Failed');  
                        }
                    }

                    trace.write('taskResult: ' + taskResult);
                    jobCtx.setTaskResult(item.instanceId, item.name, taskResult);

                    taskCtx.end();
                    done(err);
                });
            }, function (err) {
                serviceContext.info('Done running tasks.');
                trace.write('jobResult: ' + jobResult);

                if (err) {
                    serviceContext.error(err.message);
                    callback(err, jobResult);
                    return;
                }

                callback(null, jobResult);
            });
    }

    private taskExecution = {};
    private taskMetadata = {};

    private prepareTask(task: agentifm.TaskInstance, callback) {
        trace.enter('prepareTask');

        var serviceContext = this._serviceContext;

        var taskPath = path.join(this._jobContext.workingDirectory, 'tasks', task.name, task.version);
        trace.write('taskPath: ' + taskPath);

        serviceContext.info('preparing task ' + task.name);

        var taskJsonPath = path.join(taskPath, 'task.json');
        trace.write('taskJsonPath: ' + taskJsonPath);

        fs.exists(taskJsonPath, (exists) => {
            if (!exists) {
                trace.write('cannot find task: ' + taskJsonPath);
                callback(new Error('Could not find task: ' + taskJsonPath));
                return;
            }

            // TODO: task metadata should be typed
            try {
                // Using require to help strip out BOM information
                // Using JSON.stringify/JSON.parse in order to clone the task.json object
                // Otherwise we modify the cached object for everyone
                var taskMetadata = JSON.parse(JSON.stringify(require(taskJsonPath)));
                trace.state('taskMetadata', taskMetadata);
                this.taskMetadata[task.id] = taskMetadata;

                var execution = taskMetadata.execution;

                // in preference order
                var handlers = ['Node', 'Bash', 'JavaScript'];
                var instructions;
                handlers.some(function (handler) {
                    if (execution.hasOwnProperty(handler)) {
                        instructions = execution[handler];
                        instructions["handler"] = handler;

                        trace.write('handler: ' + handler);

                        return true;
                    }
                });

                if (!instructions) {
                    trace.write('no handler for this task');
                    callback(new Error('Agent could not find a handler for this task'));
                    return;
                }

                instructions['target'] = path.join(taskPath, instructions.target);
                trace.state('instructions', instructions);
                this.taskExecution[task.id] = instructions;
                callback();
            }
            catch (e) {
                trace.write('exception getting metadata: ' + e.message);
                callback(new Error('Invalid metadata @ ' + taskJsonPath));
                return;
            }
        });
    }

    //
    // TODO: add beforeTask plugin step and move to their.  This is build specific code
    // and should not be in the generic agent code
    //
    private _processInputs(task: agentifm.TaskInstance) {
        trace.enter('processInputs');

        //
        // Resolve paths for filePath inputs
        //
        var metadata = this.taskMetadata[task.id];
        trace.write('retrieved metadata for ' + task.name);

        var filePathInputs = {};
        metadata.inputs.forEach((input) => {
            trace.write('input ' + input.name + ' is type ' + input.type);
            if (input.type === 'filePath') {
                trace.write('adding ' + input.name);
                filePathInputs[input.name] = true;
            }
        });

        trace.state('filePathInputs', filePathInputs);
        var srcFolder = this._job.environment.variables[cm.buildVars.sourceDirectory];
        trace.write('srcFolder: ' + srcFolder);

        for (var key in task.inputs) {
            trace.write('checking ' + key);
            if (filePathInputs.hasOwnProperty(key)) {
                trace.write('rewriting value for ' + key);
                var resolvedPath = path.resolve(srcFolder, task.inputs[key] || '');
                trace.write('resolvedPath: ' + resolvedPath);
                task.inputs[key] = resolvedPath;
            }
            this._jobContext.verbose(key + ': ' + task.inputs[key]);
        }

        trace.state('task.inputs', task.inputs);
    }

    private runTask(task: agentifm.TaskInstance, ctx: ctxm.TaskContext, callback) {
        trace.enter('runTask');
        
        this._serviceContext.info('Task: ' + task.name);
        
        //TODO: This call should be made to the plugin as it is build specific
        if (ctx.variables[cm.sysVars.system].toLowerCase() === 'Build'.toLowerCase()) {
            this._processInputs(task);
        }

        for (var key in task.inputs) {
            ctx.verbose(key + ': ' + task.inputs[key]);
        }
        ctx.verbose('');
        ctx.inputs = task.inputs;

        var execution = this.taskExecution[task.id];
        trace.state('execution', execution);

        var handler = require('./handlers/' + execution.handler);
        this._serviceContext.info('running ' + execution.target + ' with ' + execution.handler);

        trace.write('calling handler.runTask');
        handler.runTask(execution.target, ctx, callback);
    }
}
