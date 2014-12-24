// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var shell = require('shelljs');
var path = require('path');
var pyshell = require('python-shell');

import ctxm = require('../context');

//--------------------------------------------------------------------------------
// Handle Task authored in Python (exec ends with py: somefile.py)
//
//    scriptPath: abs path to script in tasks folder (infra figures that out)
///-------------------------------------------------------------------------------
export function runTask(scriptPath: string, ctx: ctxm.TaskContext, callback): void {

  // ensure our vso.py infra module is loadable by tasks script
  process.env['PYTHONPATH'] = __dirname;

  // we need to send the task context to it (goes over stdin)
  var begin = function(py) {
    py.send(JSON.stringify(ctx));
  }

  run(scriptPath, [], begin, callback);
}

//----------------------------------------------------------------
// Python Task: Run a python script checked into source
//----------------------------------------------------------------
export function run(script, args, begin, done): void {

  // prefer python3 over python (2).  USEPATH envvar can be set
  var usePython = process.env['USEPYTHON'];
  var pythonver = shell.which(usePython) || shell.which('python3') || shell.which('python'); 

  var sp = path.dirname(script);
  var pys = path.basename(script);

  console.log('script: ', sp, pys);

  var options = {
    mode: 'text',
    pythonPath: pythonver,
    //pythonOptions: ['-u'],
    scriptPath: sp,
    args: args
  };

  var py = new pyshell(pys, options);

  if (begin) {
    begin(py);    
  }
  
  py.on('message', function (message) {
    console.log(message);
  });

  py.on('error', function(err) {
    console.log(err.message);
  });

  py.end(function(err) {
    if (err) {
      // console.log('EC: ' + err.exitCode);
      done(err);
      return;
    }

    done(null);
  });

}
