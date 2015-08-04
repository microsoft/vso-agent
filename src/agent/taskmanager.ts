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
import agentm = require('vso-node-api/TaskAgentApi');
import webapi = require('vso-node-api/WebApi');

export class TaskManager {

    constructor(workerContext: ctxm.WorkerContext, authHandler: baseifm.IRequestHandler) {
        this.context = workerContext;
        this.agentApi = new webapi.WebApi(workerContext.config.settings.serverUrl, 
                                      authHandler).getTaskAgentApi();
        this.taskFolder = path.resolve(workerContext.config.settings.workFolder, 'tasks');
    }

    public ensureTaskExists(task: agentifm.TaskInstance, callback) : void {
        if (!this.hasTask(task)) {
            this.downloadTask(task, callback);
        } else {
            callback(null);
        }
    }

    public hasTask(task: agentifm.TaskInstance) : boolean {
        if (fs.existsSync(this.getTaskPath(task))) {
            return true;
        } else {
            return false;
        }
    }

    public ensureTasksExist(tasks: agentifm.TaskInstance[], callback: (err: any) => void) : void {
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
        this.agentApi.getTaskDefinitions(null, (err, status, tasks) => {
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

    private downloadTask(task: agentifm.TaskInstance, callback: (err: any) => void): void {
        var taskPath = this.getTaskPath(task);
        var filePath = taskPath + '.zip';
        if (fs.existsSync(filePath)) {
            callback(new Error('File ' + filePath + ' already exists.'));
            return;
        }
        shell.mkdir('-p', taskPath);
        this.agentApi.getTaskContentZip(task.id, task.version, (err, statusCode, res) => {
            if (err) {
                callback(err);
                return;
            }

            var fileStream: NodeJS.WritableStream = fs.createWriteStream(filePath);
            res.pipe(fileStream);

            fileStream.on('finish', function () {
                cm.extractFile(filePath, taskPath, (err) => {
                    if (err) {
                        shell.rm('-rf', taskPath);
                    }

                    shell.rm('-rf', filePath);
                    fileStream.end();
                    callback(err);
                });
            });
        });
    }

    private getTaskPath(task: agentifm.TaskInstance) : string {
        return path.resolve(this.taskFolder, task.name, task.version);
    }

    private getTaskInstance(task: agentifm.TaskDefinition) : agentifm.TaskInstance {
        return <agentifm.TaskInstance>{'id':task.id, 'name': task.name, 'version': cm.versionStringFromTaskDef(task)}
    }

    private context: ctxm.WorkerContext;
    private agentApi: agentm.ITaskAgentApi;
    private taskFolder: string;
}