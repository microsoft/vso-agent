
import cm = require('../common');
import ctxm = require('../context');
import path = require('path');
import shell = require('shelljs');
import tm = require('../tracing');
import cmdm = require('../commands/command');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

var vsotask = require('vso-task-lib');

var _commandPath = path.resolve(__dirname, '../commands');

var _trace: tm.Tracing;

var _cmdQueue: cm.IAsyncCommandQueue;

function _processLine(line: string, executionContext: cm.IExecutionContext): void {
	if (line.startsWith(cm.CMD_PREFIX)) {
        _handleCommand(line, executionContext);
	}
    else {
        executionContext.info(line);
    }
}

function _handleCommand(commandLine: string, executionContext: cm.IExecutionContext) {
    var cmd: cm.ITaskCommand;

    try {
        var temp = vsotask.commandFromString(commandLine);
        cmd = new cmdm.TaskCommand(temp.command, temp.properties, temp.message);
    }
    catch(err) {
        executionContext.warning(err.message + ': ' + commandLine);
        return;
    }

    var cmdModulePath = path.join(__dirname, '..', 'commands', cmd.command + '.js');
    if (!shell.test('-f', cmdModulePath)) {
        executionContext.warning('command module does not exist: ' + cmd.command);
        return;
    }

    var cmdPlugin = require(cmdModulePath);

    if (cmdPlugin.createSyncCommand) {
        var syncCmd = cmdPlugin.createSyncCommand(cmd);
        syncCmd.runCommand(executionContext);    
    }
    else if (cmdPlugin.createAsyncCommand) {
        var asyncCmd = cmdPlugin.createAsyncCommand(executionContext, cmd);
        _cmdQueue.push(asyncCmd);
    }
    else {
        executionContext.warning('Command does not implement runCommand or runCommandAsync: ' + cmd.command);
    }   
}

export function run(scriptEngine: string, scriptPath: string, executionContext: cm.IExecutionContext, callback) {
    _trace = new tm.Tracing(__filename, executionContext);
    _cmdQueue = executionContext.service.createAsyncCommandQueue(executionContext);
    _cmdQueue.startProcessing();

    var jobMessage: agentifm.JobRequestMessage = executionContext.jobInfo.jobMessage;

    //
    // Inputs
    //
    var env = {} 

    // deep copy the vars so we don't dirty the workers environment with
    // a specific tasks inputs etc...
    for (var key in process.env) {
        env[key] = process.env[key];
    }

    _trace.write('setting inputs as environment variables');
    for (var key in executionContext.inputs){
        var envVarName = 'INPUT_' + key.replace(' ', '_').toUpperCase();
        env[envVarName] = executionContext.inputs[key];
        _trace.write('INPUT VAR: ' + envVarName + '=' + env[envVarName]);
    }

    //
    // Variables
    //
    var vars = jobMessage.environment.variables;
    for (var variable in vars) {
        var envVarName: string = variable.replace(".", "_").toUpperCase();
        env[envVarName] = vars[variable];
        _trace.write('VAR VAL: ' + envVarName + '=' + vars[variable]);
    }

    //
    // Endpoints
    //
    var endpoints = jobMessage.environment.endpoints;
    if (endpoints) {
        for (var i=0; i < endpoints.length; i++) {
            var endpoint = endpoints[i];
            _trace.state('service endpoint', endpoint);

            if (endpoint.id && endpoint.url && endpoint.authorization) {
                env['ENDPOINT_URL_' + endpoint.id] = endpoint.url;
                env['ENDPOINT_AUTH_' + endpoint.id] = JSON.stringify(endpoint.authorization);
            }
        }
    }

    var ops = {
        cwd: process.cwd(),
        env: env
    };

    executionContext.verbose('cwd: ' + ops.cwd);

    var cp = require('child_process').spawn;

    var engPath = shell.which(scriptEngine);
    if (!engPath) {
        callback(new Error('Invalid script engine: ' + scriptEngine), 1);
        return;
    }
    _trace.write('engPath: ' + engPath);

    if (!shell.test('-f', scriptPath)) {
        callback(new Error('Invalid script path: ' + scriptPath), 1);
        return;
    }
    _trace.write('scriptPath: ' + scriptPath);

    var runCP = cp(engPath, [scriptPath], ops);

    var _handleData = function(data, buffer, onLine:(line: string) => void) {
    	var s = buffer + data.toString();
    	var n = s.indexOf('\n');

    	while(n > -1) {
    		var line = s.substring(0, n);
    		onLine(line);

    		s = s.substring(n + 1);
    		n = s.indexOf('\n');
    	}

    	buffer = s;
    }

    var _flushErrorBuffer = function() {
        if (_errBuffer.length > 0) {
            executionContext.error(_errBuffer);
            _errBuffer = '';
        }
    }

    // we want to split stdout on lines for commands 
	var _outBuffer = '';
    runCP.stdout.on('data', function(data) {
        _flushErrorBuffer();
        _handleData(data, _outBuffer, (line: string) => {
            _processLine(line, executionContext);    
        });
    });

    // for errors however, we want to send a whole block
    // of errout as one error (issue) up until we hit stdout again (stack trace for example)
    var _errBuffer = '';
    runCP.stderr.on('data', function(data) {
        _errBuffer += data.toString();
    });

    runCP.on('exit', function(code) {
        _trace.write('exit: ' + code);

        // drain buffers
        if (_outBuffer.length > 0) {
            executionContext.info(_outBuffer);
        }

        _flushErrorBuffer();

        // drain async commands
        _cmdQueue.finishAdding();
        _cmdQueue.waitForEmpty()
        .then(function() {
            if (code == 0) {
                if (_cmdQueue.failed) {
                    callback(_cmdQueue.errorMessage, code);
                }
                else {
                    callback(null, code);    
                }
            } else {
                var msg = 'Return code: ' + code;
                executionContext.error(msg);

                callback(new Error(msg), code);
            }
        })
    });
}
