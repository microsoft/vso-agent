// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/node.d.ts"/>
/// <reference path="./definitions/Q.d.ts" />

import Q = require('q');
import fs = require('fs');
import os = require('os');
import cm = require('./common');

var shell = require('shelljs');

// Declare environment variables to ignore sending as capabilities
// in addition to those declared through the VSO_AGENT_IGNORE environment variable:
// export VSO_AGENT_IGNORE=envvar1,envvar2
var ignore = [
    'TERM_PROGRAM', 
    'TERM', 
    'TERM_PROGRAM_VERSION', 
    'SHLVL', 
    'ls_colors', 
    'comp_wordbreaks'
];

// Gets environment variables, filtering out those that are declared to ignore.
var getFilteredEnv = function(): { [key: string]: string } {
    // Begin with ignoring env vars declared herein
    var filter = ignore;

    // Also ignore env vars specified in the 'VSO_AGENT_IGNORE' env var
    if (process.env[cm.envIgnore]) {
        filter = filter.concat(process.env[cm.envIgnore].split(','));
    }
    
    // Get filtered env vars
    var filtered: { [key: string]: string } = {};
    for (var envvar in process.env) {
        if (filter.indexOf(envvar) < 0 && process.env[envvar].length < 1024) {
            setCapability(filtered, envvar, process.env[envvar]);
        }
    }

    return filtered;
}

// Ensures existence of the environment file at the specified path, creating it if missing.
export function ensureEnvFile(envPath): Q.Promise<void> {
    var defer = Q.defer<void>();

    fs.exists(envPath, function(exists) {
        if (exists) {
            defer.resolve(null);
            return;
        };

        var vars: { [key: string]: string } = getFilteredEnv();

        var contents = "";
        for (var envvar in process.env) {
            contents += envvar + '=' + process.env[envvar] + os.EOL;
        }

        fs.writeFile(envPath, contents, 'utf8', (err) => {
            if (err) {
                defer.reject(new Error('Could not create env file: ' + err.message));
            }
            else {
                defer.resolve(null);
            } 
        });
    });  

    return defer.promise; 
}

// Gets the environment that the agent and worker will use when running as a service.
// The current process' environment is overlayed with contents of the environment file.
// When not running as a service, the interactive/shell process' environment is used.
export function getEnv(envPath: string, complete: (err: any, env: {[key: string]: string}) => void): void {
    var env: {[key: string]: string} = process.env;

    fs.exists(envPath, function(exists) {
        if (exists) {
            fs.readFile(envPath, function(err, data) {
                if (err) {
                    complete(err, null);
                    return;
                }

                var lines = data.toString('utf8').split(os.EOL);
                for (var lidx in lines) {
                    var line = lines[lidx];
                    var tokens = line.split('=');
                    if (tokens.length == 2) {
                        var envkey = tokens[0].trim();
                        var envval = tokens[1].trim();
                        if (envkey.length > 0 && envval.length > 0) {
                            env[envkey] = envval;
                        }
                    }
                }

                complete(null, env);
            });         
        }
        else {
            complete(null, null);
        }   
    });
}

// Adds an environmental capability based on existence of the specified tool.
// filteredEnv:    The current environment in which to add a new capability if the specified tool exists.
// tool:           The tool whose existence indicates capability.
//                 This can be a tool name or an object encapsulating the tool name and its well-known paths:
//                 { name: 'mytool', paths: ['/Applications/MyApp1/mytool', '/Applications/MyApp2/mytool'] }
// capability:     The name of the capability to add to the environment if the specified tool exists.
//                 If no capability is specified, the tool name will be used.
// valueIfMissing: The name of the capability to add to the environment if the specified tool does not exist (optional).
// Returns true if a capability was added to the specified environment; otherwise false.
var resolveCapability = function (filteredEnv: any, tool: any, capability?: string, valueIfMissing?: string): boolean {
    // Initialize
    var result = false;
    var toolName;

    // Is tool an object or a string?
    if (typeof tool === 'object') {
        toolName = tool.name;
        // First, attempt to find the tool using 'which'
        result = resolveCapability(filteredEnv, tool.name, capability);
        if (result == false && tool.paths != null) {
            // Next, look for the tool in each specified well-known path
            for (var i = 0; i < tool.paths.length; i++) {
                if (fs.existsSync(tool.paths[i])) {
                    setCapability(filteredEnv, capability || tool.name, tool.paths[i]);
                    result = true;
                    break;
                }
            }
        }
    }
    else {
        // Attempt to find the tool using 'which'
        toolName = tool;
        var toolpath = shell.which(tool);
        if (toolpath) {
            setCapability(filteredEnv, capability || tool, toolpath);
            result = true;
        }
    }

    // If the tool was not found but a default value was specified, set the capability with that default value.
    if (result == false && valueIfMissing != null) {
        setCapability(filteredEnv, capability || (typeof tool === 'object') ? tool.name : tool, valueIfMissing);
        result = true;
    }

    if (!result) {
        cm.consoleTrace('cap ' + toolName + ' not found');
    }
    return result;
}

// Executes the specified command for resolution of a capability and retrieval of its value.
var resolveCapabilityViaShell = function(filteredEnv: any, command: string, args: string, capability: string) {
    var tool = shell.which(command);
    if (!tool) {
        return;
    }

    var val = shell.exec(command + ' ' + args, {silent:true}).output;
    if (val) {
        setCapability(filteredEnv, capability, val);
    }
}

// Adds the specified capability name and value to the specified environment.
var setCapability = function (filteredEnv: cm.IStringDictionary, name: string, val: string) {
    cm.consoleTrace('cap ' + name + '=' + val);
    filteredEnv[name.trim()] = val;
}

// Gets the filtered, environmental capabilities of the current process.
export function getCapabilities(): cm.IStringDictionary {
    var filteredEnv: cm.IStringDictionary = getFilteredEnv();

    cm.consoleTrace('PATH=' + process.env['PATH']);
    resolveCapability(filteredEnv, 'ant');
    resolveCapability(filteredEnv, 'clang');
    resolveCapability(filteredEnv, 'cmake');
    resolveCapability(filteredEnv, 'curl');
    resolveCapability(filteredEnv, 'git');
    resolveCapability(filteredEnv, 'jake', null, '.'); // If not in global path, use jake packaged in this agent
    resolveCapability(filteredEnv, 'java');
    resolveCapability(filteredEnv, 'make');
    resolveCapability(filteredEnv, { name: 'mdtool', paths: ['/Applications/Xamarin Studio.app/Contents/MacOS/mdtool'] }, 'Xamarin.iOS');
    resolveCapability(filteredEnv, 'mvn', 'maven');
    resolveCapability(filteredEnv, 'node', 'node.js');
    resolveCapability(filteredEnv, 'nodejs', 'node.js');
    resolveCapability(filteredEnv, 'npm');
    resolveCapability(filteredEnv, 'gulp');
    resolveCapability(filteredEnv, 'python');
    resolveCapability(filteredEnv, 'python3');
    resolveCapability(filteredEnv, 'sh');
    resolveCapability(filteredEnv, 'svn', 'subversion');
    resolveCapability(filteredEnv, 'ruby')
    resolveCapability(filteredEnv, 'rake');
    resolveCapability(filteredEnv, 'bundle', 'bundler');
    resolveCapabilityViaShell(filteredEnv, 'xcode-select', '-p', 'xcode');

    return filteredEnv;
}
