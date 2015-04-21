var Q = require('q');
var shell = require('shelljs');
var fs = require('fs');
var path = require('path');
var os = require('os');
var minimatch = require('minimatch');
var tcm = require('./taskcommand');
var trm = require('./toolrunner');
var cm = require('../../agent/common');
var webapi = require('../../agent/api/webapi');

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
var _writeCommand = function(command, properties, message) {
    var taskCmd = new tcm.TaskCommand(command, properties, message);
    _writeLine(taskCmd.toString());
}
exports.command = _writeCommand;

var _warning = function(message) {
    _writeCommand('task.issue', {'type': 'warning'}, message);
}
exports.warning = _warning;

var _error = function(message) {
    _writeCommand('task.issue', {'type': 'error'}, message);
}
exports.error = _error;

var _debug = function(message) {
    _writeCommand('task.debug', null, message);
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

var _cp = function (options, source, dest) {
    shell.cp(options, source, dest);
}
exports.cp = _cp;

//-----------------------------------------------------
// Tools
//-----------------------------------------------------
exports.TaskCommand = tcm.TaskCommand;
exports.commandFromString = tcm.commandFromString;
exports.ToolRunner = trm.ToolRunner;
trm.debug = _debug;

//-----------------------------------------------------
// Matching helpers
//-----------------------------------------------------
var _match = function (list, pattern, options) {
    return minimatch.match(list, pattern, options);
}
exports.match = _match;

var _matchFile = function (list, pattern, options) {
    return minimatch(list, pattern, options);
}
exports.matchFile = _matchFile;

var _filter = function (pattern, options) {
    return minimatch.filter(pattern, options);
}
exports.filter = _filter;
