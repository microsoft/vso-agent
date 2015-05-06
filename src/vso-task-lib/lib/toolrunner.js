var Q = require('q');
var os = require('os');
//var util = require('util');
//var stream = require('stream');
var shell = require('shelljs');

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

var _debug = function(message) {
    // do nothing, overridden
};
exports.debug = _debug;

var _toolRunner = (function(){
    function ToolRunner(toolPath) {
        exports.debug('toolRunner toolPath: ' + toolPath);
        this.toolPath = toolPath;
        this.args = [];
    }

    ToolRunner.prototype.arg = function(arguments) {
        if (arguments instanceof Array) {
            exports.debug(this.toolPath + ' arg: ' + JSON.stringify(arguments));
            this.args = this.args.concat(arguments);
        }
        else if (typeof(arguments) === 'string') {
            exports.debug(this.toolPath + ' arg: ' + arguments);
            this.args.push(arguments);
        }
    }

    ToolRunner.prototype.exec = function(options) {
        var defer = Q.defer();

        exports.debug('exec tool: ' + this.toolPath);
        exports.debug('Arguments:');
        this.args.forEach(function(arg) {
            exports.debug('   ' + arg);
        });

        var success = true;
        options = options || {};

        var ops = {
            cwd: process.cwd(),
            env: process.env,
            silent: options.silent || false,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false
        };

        var argString = this.args.join(' ') || '';
        var cmdString = this.toolPath;
        if (argString) {
            cmdString += (' ' + argString);
        }
        ops.outStream.write('[command]' + cmdString + os.EOL);

        var runCP = shell.exec(cmdString, {async: true, silent: true}, function(code, output) {
            exports.debug('rc:' + code);

            if (code != 0 && !ops.ignoreReturnCode) {
                success = false;
            }
            
            exports.debug('success:' + success);
            if (success) {
                defer.resolve(code);
            }
            else {
                defer.reject(new Error(this.toolPath + ' failed with return code: ' + code));
            }
        });

        runCP.stdout.on('data', function(data) {
            if (!ops.silent) {
                ops.outStream.write(data);    
            }
        });

        runCP.stderr.on('data', function(data) {
            success = !ops.failOnStdErr;
            if (!ops.silent) {
                ops.errStream.write(data);
            }
        })

        return defer.promise;
    }

    return ToolRunner;
})();
exports.ToolRunner = _toolRunner;
