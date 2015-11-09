// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/async.d.ts"/>
import cm = require('./common');
import ctxm = require('./context');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import async = require('async');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');
import Q = require('q');
import agentm = require('vso-node-api/TaskAgentApi');
import webapi = require('vso-node-api/WebApi');

export class TaskManager {
    constructor(executionContext: cm.IExecutionContext) {
        this.executionContext = executionContext;
        var taskDefinitionsUri = this.getTaskDefinitionsUri();
        this.executionContext.trace("TaskDownloader will download tasks from " + taskDefinitionsUri);
        this.taskApi = new webapi.WebApi(taskDefinitionsUri, 
                                      executionContext.authHandler).getTaskAgentApi();
        this.taskFolder = path.resolve(executionContext.hostContext.workFolder, 'tasks');
    }

    public ensureTaskExists(task: agentifm.TaskInstance): Q.IPromise<any> {
        if (!this.hasTask(task)) {
            return this.downloadTask(task);
        } else {
            return Q.resolve(null);
        }
    }

    public hasTask(task: agentifm.TaskInstance) : boolean {
        if (fs.existsSync(this.getTaskPath(task))) {
            return true;
        } else {
            return false;
        }
    }

    public ensureTasksExist(tasks: agentifm.TaskInstance[]): Q.IPromise<any> {
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
        
        var promises = tasks.map((task: agentifm.TaskInstance) => {
            return this.ensureTaskExists(task);
        });
        
        return Q.all(promises);
    }

    public ensureLatestExist(): Q.IPromise<any> {
        var deferred = Q.defer();
        
        // Get all tasks
        this.taskApi.getTaskDefinitions(null, null, null, (err, status, tasks) => {
            if (err) {
                deferred.reject(err);
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
            this.ensureTasksExist(latestTasks).then(() => {
                deferred.resolve(null);
            }, (err: any) => {
                deferred.reject(err);
            });
        });
        
        return deferred.promise;
    }

    private downloadTask(task: agentifm.TaskInstance): Q.IPromise<any> {
        var taskPath = this.getTaskPath(task);
        var filePath = taskPath + '.zip';
        if (fs.existsSync(filePath)) {
            return Q.reject(new Error('File ' + filePath + ' already exists.'));
        }
        
        var deferred = Q.defer();
        shell.mkdir('-p', taskPath);

        this.executionContext.trace("Downloading task " + task.id + " v" + task.version + " to " + taskPath);
        this.taskApi.getTaskContentZip(task.id, task.version, null, null, (err, statusCode, res) => {
            if (err) {
                deferred.reject(err);
            }

            var fileStream: NodeJS.WritableStream = fs.createWriteStream(filePath);
            res.pipe(fileStream);

            fileStream.on('finish', function () {
                cm.extractFile(filePath, taskPath, (err) => {
                    if (err) {
                        shell.rm('-rf', taskPath);
                        deferred.reject(err);
                    }

                    shell.rm('-rf', filePath);
                    fileStream.end();
                    deferred.resolve(null);
                });
            });
        });
        
        return deferred.promise;
    }

    private getTaskPath(task: agentifm.TaskInstance) : string {
        return path.resolve(this.taskFolder, task.name, task.version);
    }

    private getTaskInstance(task: agentifm.TaskDefinition) : agentifm.TaskInstance {
        return <agentifm.TaskInstance>{'id':task.id, 'name': task.name, 'version': cm.versionStringFromTaskDef(task)}
    }
    
    private getTaskDefinitionsUri(): string {
        var taskDefinitionsUri = this.executionContext.variables[cm.vars.systemTaskDefinitionsUri];
        if (!taskDefinitionsUri) {
            taskDefinitionsUri = this.executionContext.variables[cm.vars.systemTfCollectionUri];
        }
        if (!taskDefinitionsUri) {
            taskDefinitionsUri = this.executionContext.config.settings.serverUrl; 
        }
        return taskDefinitionsUri;
    }

    private executionContext: cm.IExecutionContext;
    private taskApi: agentm.ITaskAgentApi;
    private taskFolder: string;
}