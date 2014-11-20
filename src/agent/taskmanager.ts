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
import cm = require('./common');
import ctxm = require('./context');
import ifm = require('./api/interfaces');
import async = require('async');
import fs = require('fs');
import path = require('path');
import shell = require('shelljs');

export class TaskManager {

	constructor(agentContext: ctxm.AgentContext) {
		this.context = agentContext;
		this.taskApi = cm.createTaskApi(agentContext.config.settings.serverUrl, 
										agentContext.config.creds.username, 
										agentContext.config.creds.password);
		this.taskFolder = path.resolve(agentContext.config.settings.workFolder, 'tasks');
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

	private context: ctxm.AgentContext;
	private taskApi: ifm.ITaskApi;
	private taskFolder: string;
}