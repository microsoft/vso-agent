var Q = require('q');
var os = require('os');

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
    // do nothing by default, but consumer can override
};
exports.debug = _debug;

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
