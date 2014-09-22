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

/// <reference path="./definitions/nconf.d.ts"/>
var os = require('os');
var nconf = require("nconf");	
var async = require("async");
var path = require("path");
var fs = require('fs');
var check = require('validator');
var shell = require('shelljs');

import ifm = require('./api/interfaces');
import cm = require('./common');
import env = require('./environment');
import inputs = require('./inputs');

var configPath = path.join(__dirname, '.agent');
var envPath = path.join(__dirname, 'env.agent');

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

var ifOK = function(err, complete, onSuccess) {
	if (err) {
		complete(err);
	} else {
		onSuccess();
		complete();
	}
}

var throwIf = function(condition, message) {
	if (condition) {
		throw new Error(message);
	}
}

export class Configurator {
	constructor() {}

	public agentApi: ifm.IAgentApi;

	public ensureConfigured(complete: (err: any, settings: cm.ISettings, creds:any) => void): void {
		var settings: cm.ISettings = read();
		if (!settings.serverUrl) {
			console.log("no settings found. configuring...");
			this.create((err, agent, config) => {
				if (err) {
					complete(err, null, null);
					return;
				}

				complete(err, config.settings, config.creds);
			});
			return;
		}
		else {
			cm.initAgentApi(settings.serverUrl, (err, agentapi, creds) => {
		        if (err) {
		            complete(err, null, null);
		            return;
		        }
		        this.agentApi = agentapi;
				complete(null, settings, creds);
			});
		}
	}

	public create(complete: (err: any, agent: ifm.TaskAgent, config: cm.IConfiguration) => void): void {
		var config:cm.IConfiguration = <cm.IConfiguration>{};
		var settings:cm.ISettings;
		var newAgent: ifm.TaskAgent;
		var agentPoolId = 0;

		var cfgInputs = [
			{
				name: 'serverUrl', description: 'server url', arg: 's', type: 'string', req: true
			},
			{
                name: 'agentName', description: 'agent name', arg: 'a', def: os.hostname(), type: 'string', req: true
            },
			{
				name: 'poolName', description: 'agent pool name', arg: 'l', def: 'default', type: 'string', req: true
			},
			{
				name: 'workFolder', description: 'agent work folder', arg: 'f', def: './work', type: 'string', req: true
			}		
		];

		var inst = this;
		async.series([
			// get the cfg inputs
			function(stepDone) {
				inputs.get(cfgInputs, function(err, result) {
					settings = <cm.ISettings>{};
					settings['poolName'] = result['poolName'];
					settings['serverUrl'] = result['serverUrl'];
					settings['agentName'] = result['agentName'];
					settings['workFolder'] = result['workFolder'];
					config.settings = settings;
					stepDone(err);
				});
			},
			// get the creds
			function(stepDone) {
				cm.initAgentApi(settings['serverUrl'], (err, api, creds) => {
					inst.agentApi = api;
					config.creds = creds;
					stepDone(err);
				});
			},
			// validate and register the agent
			function(stepDone) {
				console.log('Register the agent ...');
				try {
					inst.validate(settings);
				} catch (e) {
					stepDone(new Error(e.message));
					return;
				}

				inst.writeAgentToPool(settings, inst.agentApi, (err, agent, poolId) => {
					if (err) { stepDone (err); return;}
					config.poolId = poolId;
					newAgent = agent; 
					stepDone();
				});
			},
			// create the work folder if it doesn't exist
			function(stepDone) {
				var wf = settings.workFolder;
				if (fs.exists(wf, function(exists) {
					if (!exists) {
						console.log('Creating work folder ...');
						try {
							shell.mkdir('-p', wf);	
						}
						catch (e) {
							console.log('Could not create the work folder');
						}
					}
					stepDone();
				}));
			},
			// if not exist, create a starter env vars file
			function (stepDone) {
				env.ensureEnvFile(envPath, (err) => {
					stepDone(err);
				});
			},	
			// save the input
			function(stepDone) {
				console.log('Saving ...');

				fs.writeFile(configPath, JSON.stringify(config.settings, null, 2), (err) => {
						stepDone(err);	
					});
			}
		], function(err) {
			if (err) {
				console.error('Failed to register agent');
				complete(err, null, null);
				return;
			}
			complete(null, newAgent, config);
		});
	}

	public readAgentPool(agentapi: ifm.IAgentApi, settings: cm.ISettings, complete: (err: any, agent: ifm.TaskAgent, poolId: number) => void): void {
		var agentPoolId = 0;
		var agentQueue = '';
		var agent;

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
						// should be one host.  if 0, needs to be configured
						if (agents.length > 0)
							agent = agents[0];
					});
				});
			},
		], function(err) {
			if (err) { 
				console.error('Failed to read agent');
				complete(err, null, 0); return; 
			}
			complete(null, agent, agentPoolId);
		});
	}

	//-------------------------------------------------------------
	// Private
	//-------------------------------------------------------------
	private validate(settings: cm.ISettings) {
		throwIf(!check.isURL(settings.serverUrl), settings.serverUrl + ' is not a valid URL');
	}

	private writeAgentToPool(settings: cm.ISettings, agentapi: ifm.IAgentApi, complete: (err: any, agent: ifm.TaskAgent, poolId: number) => void): void {
		var agentPoolId = 0;
		var updateAgents = false;
		var newAgent:ifm.TaskAgent;
		var agentQueue = '';

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


