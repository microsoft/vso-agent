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

/// <reference path="./definitions/node.d.ts"/>

import childProcess = require("child_process");
import os = require("os");
import fs = require("fs");
import cfgm = require("./configuration");
import ctxm = require('./context');
import listener = require('./api/messagelistener');
import ifm = require('./api/interfaces');
import dm = require('./diagnostics');
import path = require('path');
import cm = require('./common');
import tm = require('./tracing');
import taskm = require('./taskmanager');

var inDebugger = (typeof global.v8debug === 'object');

var ag: ctxm.AgentContext;
var trace: tm.Tracing;
var cfgr: cfgm.Configurator = new cfgm.Configurator();
var messageListener: listener.MessageListener;

var runWorker = function(ag: ctxm.AgentContext, workerMsg) {

    var worker: childProcess.ChildProcess = childProcess.fork(path.join(__dirname, 'vsoworker'), [], {
    	env: process.env,
    	execArgv: []
    });

    // TODO: replace with server LogggingQueues
    //var consoleWriter = require('./logging/consoleWriter');

    // worker ipc callbacks
    worker.on('message', function(msg){
    	try {
	        if (msg.messageType === 'log') {
	        	// log data event - need to send to server
				// console.log('pageComplete: ', msg.data.logInfo.recordId, msg.data.pageNumber, msg.data.pagePath);
	        }
	        else if (msg.messageType === 'status') {
	        	// consoleWriter.writeStatus(msg.data);
	        }
    	}
        catch (err) {
        	ag.error("host" + err);
        }
    });

    ag.verbose('host::workerSend');
    worker.send(workerMsg);
}

var INIT_RETRY_DELAY = 15000;
var doInit = function(settings: cm.ISettings, creds: any, complete: (err:any, agent: ifm.TaskAgent, config: cm.IConfiguration) => void): void {
    cfgr.readAgentPool(cfgr.agentApi, settings, (err, agent, poolId) => {
        if (err) {
        	console.error('Could not initialize.  Retrying in ' + INIT_RETRY_DELAY/1000 + ' sec');
        	console.error(err.message);
            setTimeout(() => {
            		initAgent(settings, creds, complete);
            	}, INIT_RETRY_DELAY);
            return;
        }

        if (agent) {
            var config: cm.IConfiguration = <cm.IConfiguration>{};

            // config = read();
            config.creds = creds;
            config.poolId = poolId;
            config.settings = settings;
            complete(null, agent, config);
            return;
        }
        else {
            console.error('No agent returned from server.  Configure the agent and restart the agent.');
        }
    });
}

var initAgent = function(settings: cm.ISettings, creds: any, complete: (err:any, agent: ifm.TaskAgent, config: cm.IConfiguration) => void): void {
    //
    // Once configured, initializing the agent will not fail on an unavailable service.
    // If the agent starts up (most likely as a service) and the server goes unavailable,
    // the agent should
    //
    doInit(settings, creds, complete);
} 

cfgr.ensureConfigured((err: any, settings: cm.ISettings, creds:any) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}

	initAgent(settings, creds, (err:any, agent: ifm.TaskAgent, config: cm.IConfiguration) => {
		ag = new ctxm.AgentContext('agent', config, true);
        trace = new tm.Tracing(__filename, ag);
        trace.callback('initAgent');

		ag.status('Agent Started.');

        ag.info('Downloading latest tasks');
        var taskManager = new taskm.TaskManager(ag);
        taskManager.ensureLatestExist(function(err) {
            if (err) {
                ag.error('Issue downloading tasks');
                ag.error(JSON.stringify(err));
            }
        });
		var queueName = agent.name;
		ag.info('Listening for agent: ' + queueName);

		messageListener = new listener.MessageListener(cfgr.agentApi, agent, config.poolId);
        trace.write('created message listener');
		ag.info('starting listener...');

		// TODO: messageListener event emmitter for listening and reset

		messageListener.start((message: ifm.TaskAgentMessage) => {
            trace.callback('listener.start');
            
			ag.info('Message received');
            trace.state('message', message);

			var messageBody = null;
            try  {
                messageBody = JSON.parse(message.body);
            } catch (e) {
                ag.error(e);
                return;
            }

			ag.verbose(JSON.stringify(messageBody, null, 2));
			
			if (message.messageType === 'JobRequest') {
				var workerMsg = { 
					messageType:"job",
					config: config,
					data: messageBody
				}

				runWorker(ag, workerMsg);
			}
			else {
				ag.error('Unknown Message Type');
			}
        },
        (err: any) => {
            if (!err || !err.hasOwnProperty('message')) {
                ag.error("Unkown error occurred while connecting to the message queue.");
            } else {
                ag.error(err.message);
            }
        });
	});
});

process.on('uncaughtException', function (err) {
    if (ag) {
        ag.error('agent handled:')
        ag.error(err.message);
    }
    else {
    	console.error(err.message);
    }
});

process.on('SIGINT', function() {
  console.log( "\nShutting down host." );
  if (messageListener) {
    messageListener.stop( function (err) {
        if (err) {
            ag.error('Error deleting agent session:');
            ag.error(err.message);
        }
        process.exit();
    })
  }
  else {
    process.exit();
  }
})
