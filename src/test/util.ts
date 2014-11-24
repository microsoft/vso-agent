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

import cm = require('../agent/common');
import env = require('../agent/environment');
import gm = require('./lib/gitrepo');

var fs = require('fs');
var os = require('os');
var path = require('path');
var shell = require('shelljs');
var uuid = require('node-uuid');

export function createTestProjectRepo(callback: (err, repo) => void){
	var folder = createTmpFolder();
	copyTestProjects(folder);
	var repo = new gm.GitRepo(folder);
	repo.init(function (err) {
		if (!err) {
			repo.add('.', function(err) {
				if (!err) {
					repo.commit('Initial setup', false, function(err) {
						if (!err) {
							callback(null, repo);
						} else {
							callback(err, null);
						}
					});
				} else {
					callback(err, null);
				}
			});
		} else {
			callback(err, null);
		}
	});
}

export function cleanup(repo: gm.GitRepo) {
	if (!process.env.XPLAT_NO_CLEANUP) {
		shell.rm('-rf', repo.repo);
	}
}

export function createTmpFolder(): string {
	var folder = path.join(os.tmpdir(), uuid.v1());
	shell.mkdir('-p', folder);
	return folder;
}

function copyTestProjects(destination: string) {
	shell.cp('-rf', path.join(__dirname, 'projects', '*'), destination);
}

export function createTestConfig(): cm.IConfiguration {
	// TODO Do we want to create these randomly, or do we not care?
	var config:cm.IConfiguration = <cm.IConfiguration>{};
	config.settings = <cm.ISettings>{};
	config.settings.poolName = 'testPool';
	config.settings.serverUrl = 'https://yosoylocoporcornballs.com';
	config.settings.agentName = 'testAgent';
	config.settings.workFolder = './work'
	config.creds = {};
	config.creds.username = 'username';
	config.creds.password = 'password';
	config.poolId = 1;

	return config;
}

export function hasCapability(cap: string): boolean {
	var caps = env.getCapabilities();
	return (cap in caps);
}

export function createTestMessage(project: string, repoPath: string): {} {
	var config: cm.IConfiguration = createTestConfig();
	var messageBody = require('./messages/' + project + '.json');
	messageBody.environment.endpoints[0].url = repoPath;
	return { 
		messageType:"job",
		config: config,
		data: messageBody
	}
}

export function createTasksDirectory(agentFolder: string): void {
	var tasksDir = path.resolve(__dirname, agentFolder, 'work');
	shell.mkdir('-p', tasksDir);
	shell.cp('-rf', path.join(__dirname, 'tasks'), tasksDir);
}

export function deleteTasksDirectory(agentFolder: string): void {
	shell.rm('-rf', path.resolve(__dirname, agentFolder, 'work', 'tasks'));
}



