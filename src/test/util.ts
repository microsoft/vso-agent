// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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



