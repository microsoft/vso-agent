var Q = require('q');
var shell = require('shelljs');
var fs = require('fs');
var path = require('path');

var CMD_PREFIX = '##vso[';

_exit = function(code) {
    _debug('task exit: ' + code);
    shell.exit(code);
}
exports.exit = _exit;

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
_getVariable = function(name) {
    return process.env[name.replace('.', '_').toUpperCase()];
}
exports.getVariable = _getVariable;

_getInput = function(name, required) {
	var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];

    if (required && !inval) {
        console.error('Input required: ' + name);
        _exit(1);
    }

    return inval;    
}
exports.getInput = _getInput;

_getDelimitedInput = function(name, delim, required) {
    var inval = _getInput(name, required);
    return inval.split(delim);
}
exports.getDelimitedInput = _getDelimitedInput;

_getPathInput = function(name, required, check) {
    var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];

    if (required && !inval) {
        console.error('Input required: ' + name);
        _exit(1);
    }

    if (check) {
        _checkPath(inval, name);
    }
    return inval;
}
exports.getPathInput = _getPathInput;

//-----------------------------------------------------
// Cmd Helpers
//-----------------------------------------------------
var _warning = function(message) {
    console.log(CMD_PREFIX + 'task.issue type=warning]' + message);
}
exports.warning = _warning;

var _error = function(message) {
    console.log(CMD_PREFIX + 'task.issue type=error]' + message);
}
exports.error = _error;

var _debug = function(message) {
	console.log(CMD_PREFIX + 'task.debug]' + message);
}
exports.debug = _debug;

_argStringToArray = function (argString) {
    var args = argString.match(/([^" ]*("[^"]*")[^" ]*)|[^" ]+/g);

    for (var i = 0; i < args.length; i++) {
        args[i] = args[i].replace(/"/g, "");
    }
    return args;
}

//------------------------------------------------
// Validation Helpers
//------------------------------------------------
_checkPath = function(p, name) {
    _debug('check path : ' + p);
    if (!p || !fs.existsSync(p)) {
        console.error('invalid ' + name + ': ' + p);
        _exit(1);
    }    
}
exports.checkPath = _checkPath;

//-----------------------------------------------------
// Shell/File I/O Helpers
// Abstract these away so we can
// - default to good error handling
// - inject system.debug info
// - have option to switch internal impl (shelljs now)
//-----------------------------------------------------
_mkdirP = function(p) {
    if (!shell.test('-d', p)) {
        _debug('creating path: ' + p);
        shell.mkdir('-p', p);
        if (shell.error()) {
            console.error(shell.error())
            _exit(1);
        }
    }
    else {
        _debug('path exists: ' + p);
    }
}
exports.mkdirP = _mkdirP;

_which = function(tool, check) {
    var toolPath = shell.which(tool);
    if (check) {
        _checkPath(toolPath, tool);
    }
    return toolPath;
}
exports.which = _which;

//
// options (default):
//		failOnStdError: bool (true)
//		failOnNonZeroRC: bool (true)
//      echoOutput: bool (true)
//      outputHandler: function
//
// resolves bool success
//

var _toolRunner = (function(){
    function ToolRunner(toolPath) {
        _debug('toolRunner toolPath: ' + toolPath);
        this.toolPath = toolPath;
        this.args = [];
    }

    ToolRunner.prototype.arg = function(arguments) {
        if (arguments instanceof Array) {
            _debug(this.toolPath + ' arg: ' + JSON.stringify(arguments));
            this.args.concat(arguments);
        }
        else if (typeof(arguments) === 'string') {
            _debug(this.toolPath + ' arg: ' + arguments);
            this.args.push(arguments);
        }
    }

    ToolRunner.prototype.exec = function(options) {
        var defer = Q.defer();

        _debug('exec tool: ' + this.toolPath);

        if (typeof args === 'string') {
            args = _argStringToArray(args);
        }

        _debug('Arguments:');
        this.args.forEach(function(arg) {
            _debug('   ' + arg);
        });

        var success = true;
        options = options || {};

        var ops = {
            cwd: process.cwd(),
            env: process.env,
            echoOutput: options.echoOutput || true,
            failOnStdErr: options.failOnStdError || true,
            failOnNonZeroRC: options.failOnNonZeroRC || true
        };

        var cp = require('child_process').spawn;
        var runCP = cp(this.toolPath, this.args, ops);

        runCP.stdout.on('data', function(data) {
            if (ops.echoOutput) {
                process.stdout.write(data);
            }
        });

        var _errStream = ops.failOnStdErr ? process.stderr : process.stdout;
        runCP.stderr.on('data', function(data) {
            success = !ops.failOnStdErr;
            if (ops.echoOutput) {
                _errStream.write(data);
            }
        });

        runCP.on('exit', function(code) {
            _debug('rc:' + code);
            if (code != 0 && ops.failOnNonZeroRC) {
                success = false;
            }
            
            _debug('success:' + success);
            if (success) {
                defer.resolve(code);
            }
            else {
                defer.reject(new Error(this.toolPath + ' failed with return code: ' + code));
            }
        });

        return defer.promise;
    }

    return ToolRunner;
})();
exports.ToolRunner = _toolRunner;
