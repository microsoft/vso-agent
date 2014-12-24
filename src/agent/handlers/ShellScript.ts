// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var shell = require('shelljs');
var path = require('path');

import ctxm = require('../context');

//--------------------------------------------------------------------------------
// Handle Task authored in a shell script (script ends in sh: somefile.sh)
//
//      scriptPath: abs path to script in tasks folder (infra figures that out)
///-------------------------------------------------------------------------------
export function runTask(scriptPath: string, ctx: ctxm.TaskContext, callback): void {
    // set env var for each input value
    for (var key in ctx.inputs){
        var envVarName = 'INPUT_' + key.toUpperCase();
        process.env[envVarName] = ctx.inputs[key];
    }

    console.log('running: ' + scriptPath);
    ctx.util.spawn('sh', [scriptPath], {}, callback);
}
