// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/nconf.d.ts"/>
/// <reference path="./definitions/Q.d.ts" />

import Q = require('q');
import ifm = require('./api/interfaces');
import cm = require('./common');
import env = require('./environment');
import inputs = require('./inputs');
import webapi = require('./api/webapi');
import utilm = require('./utilities');

var os = require('os');
var nconf = require("nconf");	
var async = require("async");
var path = require("path");
var fs = require('fs');
var check = require('validator');
var shell = require('shelljs');

var configPath = path.join(__dirname, '.agent');
var envPath = path.join(__dirname, 'env.agent');


export function exists(): boolean {
	return fs.existsSync(configPath);
}

//
// creds are not persisted in the file.  
// They are tacked on after reading from CL or prompting
//
export function read(): cm.ISettings {
	nconf.argv()
	       .env()
	       .file({ file: configPath }); 

	var settings: cm.ISettings  = {
		poolName : nconf.get("poolName"),
		serverUrl : nconf.get("serverUrl"),
		agentName : nconf.get("agentName"),
		workFolder: nconf.get("workFolder")
	}

	return settings;
}

var throwIf = function(condition, message) {
	if (condition) {
		throw new Error(message);
	}
}

export class Configurator {
	constructor() {}

	//
	// ensure configured and return ISettings.  That's it
	// returns promise
	//
	public ensureConfigured(creds: ifm.IBasicCredentials): Q.Promise<cm.ISettings> {
		var defer = Q.defer<cm.ISettings>();

		var readSettings: cm.ISettings = read();

		if (!readSettings.serverUrl) {
			// not configured
			console.log("no settings found. configuring...");

			// create should return a promise
			this.create(creds)
				.then(function(settings) {
					defer.resolve(settings);
				})
		}
		else {
			// already configured
			defer.resolve(readSettings);
		}

		return defer.promise;
	}

	//
	// Gether settings, register with the server and save the settings
	//
	public create(creds: ifm.IBasicCredentials): Q.Promise<cm.ISettings> {
		var settings:cm.ISettings;
		var newAgent: ifm.TaskAgent;
		var agentPoolId = 0;

		var cfgInputs = [
			{ name: 'serverUrl', description: 'server url', arg: 's', type: 'string', req: true },
			{ name: 'agentName', description: 'agent name', arg: 'a', def: os.hostname(), type: 'string', req: true },
			{ name: 'poolName', description: 'agent pool name', arg: 'l', def: 'default', type: 'string', req: true },
			{ name: 'workFolder', description: 'agent work folder', arg: 'f', def: './work', type: 'string', req: true }		
		];

		return inputs.Qget(cfgInputs)
		.then((result) => {
			settings = <cm.ISettings>{};
			settings['poolName'] = result['poolName'];
			settings['serverUrl'] = result['serverUrl'];
			settings['agentName'] = result['agentName'];
			settings['workFolder'] = result['workFolder'];

			this.validate(settings);
			
			return this.writeAgentToPool(creds, settings);
		})
		.then(() => {
			console.log('Creating work folder ...');
			return utilm.ensurePathExists(settings.workFolder);
		})
		.then(() => {
			console.log('Creating env file ...');
			return env.ensureEnvFile(envPath);
		})
		.then(() => {
			console.log('Saving configuration ...');
			return utilm.objectToFile(configPath, settings);
		})
		.then(() => {
			return settings;
		})
	}

	public readConfiguration(creds: ifm.IBasicCredentials, settings: cm.ISettings): Q.Promise<cm.IConfiguration> {
		var agentApi: ifm.IQAgentApi = cm.createQAgentApi(settings.serverUrl, creds);
		var agentPoolId = 0;
		var agent;

		return agentApi.connect()
		.then((connected: any) => {
			console.log('successful connect as ' + connected.authenticatedUser.customDisplayName);
			return agentApi.getAgentPools(settings.poolName);
		})
		.then((agentPools: ifm.TaskAgentPool[]) => {
			if (agentPools.length == 0) {
				throw new Error(settings.poolName + ' pool does not exist.');
			}

			// we queried by name so should only get 1
			agentPoolId = agentPools[0].id;
			console.log('Retrieved agent pool: ' + agentPools[0].name + ' (' + agentPoolId + ')'); 

			return agentApi.getAgents(agentPoolId, settings.agentName);
		}) 
		.then((agents: ifm.TaskAgent[]) => {
			if (agents.length == 0) {
				throw new Error(settings.agentName + ' does not exist in pool ' + settings.poolName);
			}

			// should be exactly one agent by name in a given pool by id
			var agent = agents[0];

            var config: cm.IConfiguration = <cm.IConfiguration>{};
            config.creds = creds;
            config.poolId = agentPoolId;
            config.settings = settings;

            return config;
		})
	}

	//-------------------------------------------------------------
	// Private
	//-------------------------------------------------------------
	private validate(settings: cm.ISettings) {
		throwIf(!check.isURL(settings.serverUrl), settings.serverUrl + ' is not a valid URL');
	}

	private writeAgentToPool(creds: ifm.IBasicCredentials, settings: cm.ISettings): Q.Promise<cm.IConfiguration> {
		var agentApi: ifm.IQAgentApi = cm.createQAgentApi(settings.serverUrl, creds);
		var agentPoolId = 0;

		return agentApi.connect()
		.then((connected: any) => {
			console.log('successful connect as ' + connected.authenticatedUser.customDisplayName);
			return agentApi.getAgentPools(settings.poolName);
		})
		.then((agentPools: ifm.TaskAgentPool[]) => {
			if (agentPools.length == 0) {
				throw new Error(settings.poolName + ' pool does not exist.');
			}

			// we queried by name so should only get 1
			agentPoolId = agentPools[0].id;
			console.log('Retrieved agent pool: ' + agentPools[0].name + ' (' + agentPoolId + ')'); 

			return agentApi.getAgents(agentPoolId, settings.agentName);
		}) 
		.then((agents: ifm.TaskAgent[]) => {

			var caps: cm.IStringDictionary = env.getCapabilities();
			caps['Agent.Name'] = settings.agentName;
			caps['Agent.OS'] = process.platform;

			if (agents.length == 0) {
				// doesn't exist, we need to create the agent
				console.log('creating agent...');

				var newAgent: ifm.TaskAgent = <ifm.TaskAgent>{
					maxParallelism: 1,
					name: settings.agentName,
					systemCapabilities: caps
				}

				return agentApi.createAgent(agentPoolId, newAgent);
			}
			else {
				console.log('updating agent...');
				var agentUpdate: ifm.TaskAgent = agents[0];

				// update just the properties user entered
				agentUpdate['maxParallelism'] = 1;
	            agentUpdate['name'] = settings.agentName;
	            agentUpdate['systemCapabilities'] = caps;				

				// TODO: we should implement force so overwrite is explicit
				return agentApi.updateAgent(agentPoolId, agentUpdate);
			}
		})
		.then((agent: ifm.TaskAgent) => {
            var config: cm.IConfiguration = <cm.IConfiguration>{};
            config.creds = creds;
            config.poolId = agentPoolId;
            config.settings = settings;

            return config;
		})
	}
}
