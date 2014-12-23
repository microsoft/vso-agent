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
import util = require('./utilities');

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

/*
var ifOK = function(err, complete, onSuccess) {
	if (err) {
		complete(err);
	} else {
		onSuccess();
		complete();
	}
}
*/

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
	public QensureConfigured(creds: ifm.IBasicCredentials): Q.Promise<cm.ISettings> {
		var defer = Q.defer<cm.ISettings>();

		var readSettings: cm.ISettings = read();

		if (!readSettings.serverUrl) {
			// not configured
			console.log("no settings found. configuring...");

			// create should return a promise
			this.Qcreate(creds)
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
	public Qcreate(): Q.Promise<cm.ISettings> {
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
			
			return this.writeAgentToPool(settings);
		})
		.then(() => {
			console.log('Creating work folder ...');
			var wf = settings.workFolder;
			return util.QensurePathExists(wf);
		})
		.then(() => {
			console.log('Creating env file ...');
			return env.QensureEnvFile(envPath);
		})
		.then(() => {
			console.log('Saving configuration ...');
			return util.QobjectToFile(configPath, config.settings);
		})
		.then(() => {
			return settings;
		})
	}

	public readConfiguration(creds: ifm.IBasicCredentials, settings: cm.ISettings): Q.Promise<cm.IConfiguration> {
		var agentApi: ifm.IQAgentApi = webapi.QAgentApi(settings.serverUrl, creds);
		var agentPoolId = 0;
		var agentQueue = '';
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
            config.poolId = agnetPoolId;
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

	private appendAgentCaps(settings: cm.ISettings, caps: { [key: string]: string }) {
		caps['Agent.Name'] = settings.agentName;
		caps['Agent.OS'] = process.platform;
	}

	private writeAgentToPool(settings: cm.ISettings, agentapi: ifm.IAgentApi, complete: (err: any, agent: ifm.TaskAgent, poolId: number) => void): void {
		var agentApi: ifm.IQAgentApi = webapi.QAgentApi(settings.serverUrl, creds);
		var agentPoolId = 0;
		var updateAgents = false;
		var newAgent:ifm.TaskAgent;
		var agentQueue = '';
		var _this = this;

		async.series([
			// connect
			function(stepComplete) {
				agentapi.connect((err:any, statusCode: number, obj: any) => {
					ifOK(err, stepComplete, () => {
						console.log('successful connect as ' + obj.authenticatedUser.customDisplayName); 
					});
				});
			},
			// get pool so we can use id
			function(stepComplete) {
				agentapi.getAgentPools(settings.poolName, (err:any, statusCode: number, agentPools: ifm.TaskAgentPool[]) => {
					ifOK(err, stepComplete, () => {
						agentPoolId = agentPools[0].id;
						console.log('Retrieved agent pool: ' + agentPools[0].name + ' (' + agentPoolId + ')'); 
					});
				});	
			},
			// get the hosts in that pool - if exist, we patch the host, else we post to create	
			function(stepComplete) {
				agentapi.getAgents(agentPoolId, settings.agentName, (err:any, statusCode: number, agents: ifm.TaskAgent[]) => {
					ifOK(err, stepComplete, () => {
						updateAgents = agents.length > 0;
						newAgent = agents[0];
					});
				});	
			},
				
			// create if needed
			function(stepComplete) {
				if (updateAgents) {
					stepComplete();
					return;
				}

				console.log('creating agent...');
				var caps: { [key: string]: string } = env.getCapabilities();
				_this.appendAgentCaps(settings, caps);

				var agent = {
					maxParallelism: 1,
					name: settings.agentName,
					systemCapabilities: caps
				};

				// cast TaskHost so we don't need to set all props - iface gen should account for nullable types
				agentapi.createAgent(agentPoolId, <ifm.TaskAgent>agent, (err:any, statusCode: number, agent: ifm.TaskAgent) => {
					ifOK(err, stepComplete, () => {
						newAgent = agent;
						console.log('created.');
						console.log('Name: ' + agent.name);
					});
				});	
			},
			// update if needed
			function(stepComplete) {
				if (!updateAgents) {
					stepComplete();
					return;
				}

				var caps: { [key: string]: string } = env.getCapabilities();
				_this.appendAgentCaps(settings, caps);

				console.log('updating agent...');
	            newAgent['maxParallelism'] = 1;
	            newAgent['name'] = settings.agentName;
	            newAgent['systemCapabilities'] = caps;

				agentapi.updateAgent(agentPoolId, newAgent, (err:any, statusCode: number, agent: ifm.TaskAgent) => {
					ifOK(err, stepComplete, () => {
						newAgent = agent;
						console.log('updated.');
						console.log('Name: ' + agent.name);
					});
				});
			},		

		], function(err) {
			if (err) { complete(err, null, 0); return; }
			complete(null, newAgent, agentPoolId);
		});
	}

}




