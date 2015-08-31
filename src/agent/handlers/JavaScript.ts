// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var shell = require('shelljs');
var path = require('path');

import cm = require('../common');

//--------------------------------------------------------------------------------
// Handle Task authored in JavaScript (exec ends with js)
//
//    scriptPath: abs path to script in tasks folder (infra figures that out)
///-------------------------------------------------------------------------------
export function runTask(scriptPath: string, ctx: cm.IExecutionContext, callback): void {
  var mod = require(scriptPath);

  try {
        mod.execute(ctx, function(err) {
          if (err) {
            ctx.error(err.message); 
          }
          
          callback(err);
        });
  }
  catch (err) {
    ctx.error(err);
    callback(err);
  }
}

//----------------------------------------------------------------
// No JS task (that's Jake)
//----------------------------------------------------------------
