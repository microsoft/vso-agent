// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var runner = require('./scriptrunner');
var path = require('path');

import cm = require('../common');

//--------------------------------------------------------------------------------
// Handle Task authored in node javascript 
//
//      scriptPath: abs path to script in tasks folder (infra figures that out)
///-------------------------------------------------------------------------------

export function runTask(scriptPath: string, ctx: cm.IExecutionContext, callback): void {
    runner.run('node', scriptPath, ctx, callback);
}
