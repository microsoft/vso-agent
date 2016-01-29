// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var runner = require('./scriptrunner');
var path = require('path');
var fs = require('fs');

import cm = require('../common');

//--------------------------------------------------------------------------------
// Handle Task authored in node javascript 
//
//      scriptPath: abs path to script in tasks folder (infra figures that out)
///-------------------------------------------------------------------------------

export function runTask(scriptPath: string, ctx: cm.IExecutionContext, callback): void {
    //
    // New install method has node being pulled down into a runtime folder.  If it exists, use that one
    // But since there can be existing agents configured directly from npm (soon not supported), fallback
    //
    var nodePath = 'node';
    var internalNode = path.join(process.env['AGENT_HOMEDIRECTORY'], '..', 'runtime', 'node', 'bin', 'node');
    try{
        if (fs.existsSync(internalNode)) {
            nodePath = internalNode;
        }
        else {
            ctx.warning('Warning: internal node not found at ' + internalNode);
            ctx.warning('Falling back to globally installed node.  Will be deprecated soon.');
        }
    }
    catch (err) { 
        // ignore and fall back to 
    }

    runner.run(nodePath, scriptPath, ctx, callback);
}
