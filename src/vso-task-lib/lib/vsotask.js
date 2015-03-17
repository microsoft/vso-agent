var Q = require('q');
var shell = require('shelljs');
var fs = require('fs');
var path = require('path');
var os = require('os');

var CMD_PREFIX = '##vso[';

//-----------------------------------------------------
// General Helpers
//-----------------------------------------------------
var _outStream = process.stdout;
var _errStream = process.stderr;

var _writeError = function(str) {
    _errStream.write(str + os.EOL);
}

var _writeLine = function(str) {
    _outStream.write(str + os.EOL);
}

var _setStdStream = function(stdStream) {
    _outStream = stdStream;
}
exports.setStdStream = _setStdStream;

var _setErrStream = function(errStream) {
    _errStream = errStream;
}
exports.setErrStream = _setErrStream;

var _exit = function(code) {
    _debug('task exit: ' + code);
    shell.exit(code);
}
exports.exit = _exit;

//-----------------------------------------------------
// Input Helpers
//-----------------------------------------------------
var _getVariable = function(name) {
    return process.env[name.replace('.', '_').toUpperCase()];
}
exports.getVariable = _getVariable;

var _getInput = function(name, required) {
	var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];

    if (required && !inval) {
        _writeError('Input required: ' + name);
        _exit(1);
    }

    return inval;    
}
exports.getInput = _getInput;

var _getDelimitedInput = function(name, delim, required) {
    var inval = _getInput(name, required);
    if (!inval) {
        return [];
    }    
    return inval.split(delim);
}
exports.getDelimitedInput = _getDelimitedInput;

var _getPathInput = function(name, required, check) {
    var inval = process.env['INPUT_' + name.replace(' ', '_').toUpperCase()];

    if (required && !inval) {
        _writeError('Input required: ' + name);
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
    _writeLine(CMD_PREFIX + 'task.issue type=warning]' + message);
}
exports.warning = _warning;

var _error = function(message) {
    _writeLine(CMD_PREFIX + 'task.issue type=error]' + message);
}
exports.error = _error;

var _debug = function(message) {
	_writeLine(CMD_PREFIX + 'task.debug]' + message);
}
exports.debug = _debug;

var _argStringToArray = function (argString) {
    var args = argString.match(/([^" ]*("[^"]*")[^" ]*)|[^" ]+/g);

    for (var i = 0; i < args.length; i++) {
        args[i] = args[i].replace(/"/g, "");
    }
    return args;
}

var _cd = function(path) {
    shell.cd(path);
}
exports.cd = _cd;

var _pushd = function(path) {
    shell.pushd(path);
}
exports.pushd = _pushd;

var _popd = function() {
    shell.popd();
}
exports.popd = _popd;

//------------------------------------------------
// Validation Helpers
//------------------------------------------------
var _checkPath = function(p, name) {
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
var _mkdirP = function(p) {
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

var _which = function(tool, check) {
    var toolPath = shell.which(tool);
    if (check) {
        _checkPath(toolPath, tool);
    }
    return toolPath;
}
exports.which = _which;

//
// options (default):
//      silent: bool (false) - if true, will not echo stdout
//      failOnStdErr: bool (false)
//      ignoreReturnCode: bool (false) - if true, will not fail on non-zero return code.
//      outStream: stream (process.stdout) - stream to write stdout to. 
//      errStream: stream (process.stderr) - stream to write stderr to.
//
// resolves return code
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
            this.args = this.args.concat(arguments);
        }
        else if (typeof(arguments) === 'string') {
            _debug(this.toolPath + ' arg: ' + arguments);
            this.args.push(arguments);
        }
    }

    ToolRunner.prototype.exec = function(options) {
        var defer = Q.defer();

        _debug('exec tool: ' + this.toolPath);
        _debug('Arguments:');
        this.args.forEach(function(arg) {
            _debug('   ' + arg);
        });

        var success = true;
        options = options || {};

        var ops = {
            cwd: process.cwd(),
            env: process.env,
            silent: options.silent || false,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr
        };

        var argString = this.args.join(' ') || '';
        ops.outStream.write('[command]' + this.toolPath + ' ' + argString + os.EOL);

        var cp = require('child_process').spawn;
        var runCP = cp(this.toolPath, this.args, ops);

        runCP.stdout.on('data', function(data) {
            if (!ops.silent) {
                ops.outStream.write(data);
            }
        });

        var _errStream = ops.failOnStdErr ? ops.errStream : ops.outStream;
        runCP.stderr.on('data', function(data) {
            success = !ops.failOnStdErr;
            if (!ops.silent) {
                _errStream.write(data);
            }
        });

        runCP.on('exit', function(code) {
            _debug('rc:' + code);
            if (code != 0 && !ops.ignoreReturnCode) {
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
