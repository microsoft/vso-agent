// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/async.d.ts"/>
import cm = require('./common');
import ctxm = require('./context');
import ifm = require('./api/interfaces');
import async = require('async');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');
import webapi = require('./api/webapi');

export class TaskManager {
    constructor(workerContext: ctxm.WorkerContext, jobContext: ctxm.JobContext) {
        this.context = workerContext;
        var taskDefinitionsUri = this.getTaskDefinitionsUri(jobContext.variables);
        this.context.trace("TaskDownloader will download tasks from " + taskDefinitionsUri);
        this.taskApi = webapi.TaskApi(taskDefinitionsUri, 
                                      jobContext.authHandler);
        this.taskFolder = path.resolve(workerContext.config.settings.workFolder, 'tasks');
    }

    public ensureTaskExists(task: ifm.TaskInstance, callback) : void {
        if (!this.hasTask(task)) {
            this.downloadTask(task, callback);
        } else {
            callback(null);
        }
    }

    public hasTask(task: ifm.TaskInstance) : boolean {
        if (fs.existsSync(this.getTaskPath(task))) {
            return true;
        } else {
            return false;
        }
    }

    public ensureTasksExist(tasks: ifm.TaskInstance[], callback: (err: any) => void) : void {
        // Check only once for each id/version combo
        var alreadyAdded = {};
        var uniqueTasks = [];

        for (var i = 0; i < tasks.length; i++) {
            var idVersion = tasks[i].id + ':' + tasks[i].version;
            if (!(idVersion in alreadyAdded)) {
                uniqueTasks.push(tasks[i]);
                alreadyAdded[idVersion] = true;
            }
        }
        
        var _this: TaskManager = this;
        async.forEach(tasks, function(task, callreturn) {
            _this.ensureTaskExists(task, callreturn);
        }, callback);
    }

    public ensureLatestExist(callback: (err: any) => void) : void {
        // Get all tasks
        this.taskApi.getTasks(null, (err, status, tasks) => {
            if (err) {
                callback(err);
                return;
            }

            // Sort out only latest versions
            var latestIndex = {};
            var latestTasks = [];
            for (var i = 0; i < tasks.length; i++) {
                var task = tasks[i];
                if (!(task.id in latestIndex)) {
                    // We haven't seen this task id before, add it to the array, 
                    // and track the "id":"array index" pair in the dictionary
                    latestTasks.push(this.getTaskInstance(task));
                    latestIndex[task.id] = latestTasks.length - 1;
                } else if (cm.versionStringFromTaskDef(task) > latestTasks[latestIndex[task.id]].version) {
                    // We've seen this task id before, but this task is a newer version, update the task in the array
                    latestTasks[latestIndex[task.id]] = this.getTaskInstance(task);
                }
            }

            // Call ensureTasksExist for those
            this.ensureTasksExist(latestTasks, callback);
        });
    }

    private downloadTask(task: ifm.TaskInstance, callback: (err: any) => void): void {
        var taskPath = this.getTaskPath(task);
        shell.mkdir('-p', taskPath);
        this.taskApi.downloadTask(task.id, task.version, taskPath + '.zip', (err, statusCode) => {
            if (err) {
                callback(err);
                return;
            }

            cm.extractFile(taskPath + '.zip', taskPath, (err) => {
                if (err) {
                    shell.rm('-rf', taskPath);
                }

                shell.rm('-rf', taskPath + '.zip');
                callback(err);
            });
        });
    }

    private getTaskPath(task: ifm.TaskInstance) : string {
        return path.resolve(this.taskFolder, task.name, task.version);
    }

    private getTaskInstance(task: ifm.TaskDefinition) : ifm.TaskInstance {
        return <ifm.TaskInstance>{'id':task.id, 'name': task.name, 'version': cm.versionStringFromTaskDef(task)}
    }
    
    private getTaskDefinitionsUri(variables: { [key: string]: string }): string {
        var taskDefinitionsUri = variables["system.taskDefinitionsUri"];
        if (!taskDefinitionsUri) {
            // this version of the agent does not use vso-node-api, but it may run against servers that don't support the collection-level tasks
            // system.taskDefinitionsUri was added in the same sprint as collection-level tasks...
            // so if it's not there we can assume collection-level tasks aren't supported
            taskDefinitionsUri = this.context.config.settings.serverUrl; 
        }
        
        return taskDefinitionsUri;
    }

    private context: ctxm.WorkerContext;
    private taskApi: ifm.ITaskApi;
    private taskFolder: string;
}