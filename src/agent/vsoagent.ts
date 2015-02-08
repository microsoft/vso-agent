// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
import webapi = require('./api/webapi');

var Q = require('q');

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
var ensureInitialized = function(settings: cm.ISettings, creds: any, complete: (err:any, config: cm.IConfiguration) => void): void {
    cfgr.readConfiguration(creds, settings)
    .then((config: cm.IConfiguration) => {
        complete(null, config);
    })
    .fail((err) => {
        console.error(err.message);

        // exit if the pool or agent does not exist anymore
        if (err.errorCode === cm.AgentError.PoolNotExist ||
            err.errorCode === cm.AgentError.AgentNotExist) {
            console.error('Exiting.');
            return;
        }

        // also exit if the creds are now invalid
        if (err.statusCode && err.statusCode == 401) {
            console.error('Invalid credentials.  Exiting.');
            return;
        }

        console.error('Could not initialize.  Retrying in ' + INIT_RETRY_DELAY/1000 + ' sec');

        setTimeout(() => {
                ensureInitialized(settings, creds, complete);
            }, INIT_RETRY_DELAY);        
    })
}

var _creds: ifm.IBasicCredentials;

cm.readBasicCreds()
.then(function(credentials: ifm.IBasicCredentials) {
    _creds = credentials;
    return cfgr.ensureConfigured(credentials);
})
.then(function(settings: cm.ISettings) {

    ensureInitialized(settings, _creds, (err:any, config: cm.IConfiguration) => {
        if (!settings) {
            throw (new Error('Settings not configured.'));
        }

        var agent: ifm.TaskAgent = config.agent;
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

        var agentApi: ifm.IAgentApi = webapi.AgentApi(settings.serverUrl, cm.basicHandlerFromCreds(_creds));
        messageListener = new listener.MessageListener(agentApi, agent, config.poolId);
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
})
.fail(function(err) {
    console.error('Error starting the agent');
    console.error(err.message);
    process.exit(1);
})


process.on('uncaughtException', function (err) {
    if (ag) {
        ag.error('agent handled:')
        ag.error(err.message);
    }
    else {
        console.error(err.message);
    }
});

var gracefulShutdown = function() {
    console.log("\nShutting down host.");
    if (messageListener) {
        messageListener.stop(function (err) {
            if (err) {
                ag.error('Error deleting agent session:');
                ag.error(err.message);
            }
            process.exit();
        });
    } else {
        process.exit();
    }    
}

process.on('SIGINT', function () {
    gracefulShutdown();
});

process.on('SIGTERM', function () {
    gracefulShutdown();
});
