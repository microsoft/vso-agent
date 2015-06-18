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
import basicm = require('./api/handlers/basiccreds');
import utilm = require('./utilities');

var os = require('os');
var nconf = require("nconf");   
var async = require("async");
var path = require("path");
var fs = require('fs');
var check = require('validator');
var shell = require('shelljs');

var configPath = path.join(__dirname, '..', '.agent');
var envPath = path.join(__dirname, '..', 'env.agent');
var pkgJsonPath = path.join(__dirname, '..', 'package.json');


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
        poolName : nconf.get("poolName")
      , serverUrl : nconf.get("serverUrl")
      , agentName : nconf.get("agentName")
      , workFolder: nconf.get("workFolder")
      , keepLogsSeconds: nconf.get("keepLogsSeconds")
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
    public ensureConfigured (creds: ifm.IBasicCredentials): Q.Promise<cm.IConfiguration> {
        var readSettings = exports.read();

        if (!readSettings.serverUrl) {
            return this.create(creds);
        } else {
            // update agent to the server
            return this.update(creds, readSettings);
        }
    }

    public update(creds: ifm.IBasicCredentials, settings: cm.ISettings): Q.Promise<cm.IConfiguration> {
        return this.writeAgentToPool(creds, settings, true)
        .then((config: cm.IConfiguration) => {
            return config;
        });
    }

    //
    // Gether settings, register with the server and save the settings
    //
    public create(creds: ifm.IBasicCredentials): Q.Promise<cm.IConfiguration> {
        var settings:cm.ISettings;
        var configuration: cm.IConfiguration;
        var newAgent: ifm.TaskAgent;
        var agentPoolId = 0;

        var cfgInputs = [
            { name: 'serverUrl', description: 'server url', arg: 's', type: 'string', req: true },
            { name: 'agentName', description: 'agent name', arg: 'a', def: os.hostname(), type: 'string', req: true },
            { name: 'poolName', description: 'agent pool name', arg: 'l', def: 'default', type: 'string', req: true }
            
            //TODO: consider supporting work folder outside of root - long path not an issue right now for OSX/Linux
            //{ name: 'workFolder', description: 'agent work folder', arg: 'f', def: './work', type: 'string', req: true }        
            
        ];

        return inputs.Qget(cfgInputs)
        .then((result) => {
            settings = <cm.ISettings>{};
            settings.poolName = result['poolName'];
            settings.serverUrl = result['serverUrl'];
            settings.agentName = result['agentName'];
            settings.workFolder = './_work';
            settings.keepLogsSeconds = cm.DEFAULT_LOG_SECONDS;

            this.validate(settings);
            
            return this.writeAgentToPool(creds, settings, false);
        })
        .then((config: cm.IConfiguration) => {
            configuration = config;
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
            return configuration;
        })  
    }

    public readConfiguration(creds: ifm.IBasicCredentials, settings: cm.ISettings): Q.Promise<cm.IConfiguration> {
        var agentApi: ifm.IQAgentApi = webapi.QAgentApi(settings.serverUrl, cm.basicHandlerFromCreds(creds));
        var agentPoolId = 0;
        var agent;

        return agentApi.connect()
        .then((connected: any) => {
            console.log('successful connect as ' + connected.authenticatedUser.customDisplayName);
            return agentApi.getAgentPools(settings.poolName);
        })
        .then((agentPools: ifm.TaskAgentPool[]) => {
            if (agentPools.length == 0) {
                cm.throwAgentError(cm.AgentError.PoolNotExist, settings.poolName + ' pool does not exist.');
                return;
            }

            // we queried by name so should only get 1
            agentPoolId = agentPools[0].id;
            console.log('Retrieved agent pool: ' + agentPools[0].name + ' (' + agentPoolId + ')'); 

            return agentApi.getAgents(agentPoolId, settings.agentName);
        }) 
        .then((agents: ifm.TaskAgent[]) => {
            if (agents.length == 0) {
                cm.throwAgentError(cm.AgentError.AgentNotExist, settings.agentName + ' does not exist in pool ' + settings.poolName);
                return;
            }

            // should be exactly one agent by name in a given pool by id
            var agent = agents[0];

            var config: cm.IConfiguration = <cm.IConfiguration>{};
            config.creds = creds;
            config.poolId = agentPoolId;
            config.settings = settings;
            config.agent = agent;

            return config;
        })  
    }

    //-------------------------------------------------------------
    // Private
    //-------------------------------------------------------------
    private validate(settings: cm.ISettings) {
        throwIf(!check.isURL(settings.serverUrl), settings.serverUrl + ' is not a valid URL');
    }

    private getComputerName(): Q.Promise<string> {
        // I don't want the DNS resolved name - I want the computer name
        // OSX also has: 'scutil --get ComputerName'
        // but that returns machinename.local
        return utilm.exec('hostname');
    }

    private constructAgent(settings: cm.ISettings): Q.Promise<ifm.TaskAgent> {
        var caps: cm.IStringDictionary = env.getCapabilities();
        caps['Agent.Name'] = settings.agentName;
        caps['Agent.OS'] = process.platform;
        var version;
        var computerName;

        return this.getComputerName()
        .then((ret: any) => {
            computerName = ret.output;
            return utilm.objectFromFile(pkgJsonPath);
        })
        .then((pkg: any) => {
            caps['Agent.NpmVersion'] = pkg['version'];
            caps['Agent.ComputerName'] = computerName;
            
            var newAgent: ifm.TaskAgent = <ifm.TaskAgent>{
                maxParallelism: 1,
                name: settings.agentName,
                version: pkg['vsoAgentInfo']['serviceMilestone'],
                systemCapabilities: caps
            }

            return newAgent;
        })
    }

    private writeAgentToPool(creds: ifm.IBasicCredentials, settings: cm.ISettings, update: boolean): Q.Promise<cm.IConfiguration> {
        var agentApi: ifm.IQAgentApi = webapi.QAgentApi(settings.serverUrl, cm.basicHandlerFromCreds(creds));
        var agentPoolId = 0;
        var agentId = 0;

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
            if (update && agents.length == 1) {
                agentId = agents[0].id;
                return this.constructAgent(settings);
            }
            else if (update && agents.length == 0) {
                throw new Error('Agent was deleted.  Reconfigure');
            }            
            else if (agents.length == 0) {
                return this.constructAgent(settings);    
            }
            else {
                throw new Error('An agent already exists by the name ' + settings.agentName);
            }
        })
        .then((agent: ifm.TaskAgent) => {
            if (update) {
                agent.id = agentId;
                return agentApi.updateAgent(agentPoolId, agent);
            }
            else {
                return agentApi.createAgent(agentPoolId, agent);    
            }
        })
        .then((agent: ifm.TaskAgent) => {
            var config: cm.IConfiguration = <cm.IConfiguration>{};
            config.creds = creds;
            config.poolId = agentPoolId;
            config.settings = settings;
            config.agent = agent;

            return config;
        })
    }
}
