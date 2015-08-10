
import cm = require('../common');
import ctxm = require('../context');
import path = require('path');
import shell = require('shelljs');
import tm = require('../tracing');
import cmdm = require('../commands/command');

var vsotask = require('vso-task-lib');

var _commandPath = path.resolve(__dirname, '../commands');

var _trace: tm.Tracing;

var _cmdQueue: cm.IAsyncCommandQueue;

function _processLine(line: string, taskCtx:ctxm.TaskContext): void {
	if (line.startsWith(cm.CMD_PREFIX)) {
        _handleCommand(line, taskCtx);
	}
    else {
        taskCtx.info(line);
    }
}

function _handleCommand(commandLine: string, taskCtx: ctxm.TaskContext) {
    var cmd: cm.ITaskCommand;

    try {
        var temp = vsotask.commandFromString(commandLine);
        cmd = new cmdm.TaskCommand(temp.command, temp.properties, temp.message);
    }
    catch(err) {
        taskCtx.warning(err.message + ': ' + commandLine);
        return;
    }

    var cmdModulePath = path.join(__dirname, '..', 'commands', cmd.command + '.js');
    if (!shell.test('-f', cmdModulePath)) {
        taskCtx.warning('command module does not exist: ' + cmd.command);
        return;
    }

    var cmdPlugin = require(cmdModulePath);

    if (cmdPlugin.createSyncCommand) {
        var syncCmd = cmdPlugin.createSyncCommand(cmd);
        syncCmd.runCommand(taskCtx);    
    }
    else if (cmdPlugin.createAsyncCommand) {
        var asyncCmd = cmdPlugin.createAsyncCommand(taskCtx, cmd);
        _cmdQueue.push(asyncCmd);
    }
    else {
        taskCtx.warning('Command does not implement runCommand or runCommandAsync: ' + cmd.command);
    }   
}

export function run(scriptEngine: string, scriptPath: string, taskCtx:ctxm.TaskContext, callback) {
    _trace = new tm.Tracing(__filename, taskCtx.serviceContext);
    _cmdQueue = taskCtx.service.createAsyncCommandQueue(taskCtx);
    _cmdQueue.startProcessing();

    // TODO: only send all vars for trusted tasks
    var env = process.env;
    _trace.write('setting inputs as environment variables');
    for (var key in taskCtx.inputs){
        var envVarName = 'INPUT_' + key.replace(' ', '_').toUpperCase();
        env[envVarName] = taskCtx.inputs[key];
        _trace.write(envVarName + '=' + env[envVarName]);
    }

    var ops = {
        cwd: process.cwd(),
        env: env
    };

    taskCtx.verbose('cwd: ' + ops.cwd);

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
            taskCtx.error(_errBuffer);
            _errBuffer = '';
        }
    }

    // we want to split stdout on lines for commands 
	var _outBuffer = '';
    runCP.stdout.on('data', function(data) {
        _flushErrorBuffer();
        _handleData(data, _outBuffer, (line: string) => {
            _processLine(line, taskCtx);    
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
            taskCtx.info(_outBuffer);
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
                taskCtx.error(msg);

                callback(new Error(msg), code);
            }
        })
    });
}
