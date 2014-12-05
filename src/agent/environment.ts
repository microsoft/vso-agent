// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="./definitions/node.d.ts"/>

var shell = require('shelljs');
import fs = require('fs');
import os = require('os');
import cm = require('./common');

/*
set env var for additional envvars to ignore sending as capabilities
export VSO_XPLAT_IGNORE=env1,env2
*/
var ignore = [
	'TERM_PROGRAM', 
	'TERM', 
	'TERM_PROGRAM_VERSION', 
	'SHLVL', 
	'ls_colors', 
	'comp_wordbreaks'
];

var getFilteredEnv = function(): { [key: string]: string } {
	var filter = ignore;
	if (process.env[cm.envIgnore]) {
		filter = filter.concat(process.env[cm.envIgnore].split(','));
	}
	
	var filtered: { [key: string]: string } = {};
	for (var envvar in process.env) {
		if (filter.indexOf(envvar) < 0 && process.env[envvar].length < 1024) {
			filtered[envvar] = process.env[envvar];
		}
	}

	return filtered;
}

export function ensureEnvFile(envPath, done) {
	fs.exists(envPath, function(exists) {
		if (exists) {
			done();
			return;
		};

		var vars: { [key: string]: string } = getFilteredEnv();

		var contents = "";
		for (var envvar in process.env) {
			contents += envvar + '=' + process.env[envvar] + os.EOL;
		}

		fs.writeFile(envPath, contents, 'utf8', (err) => {
			done(err);	
		});
	});
}

//
// Get the env the agent and worker will use when run as a service (interactive is what it is)
// Defaults to this processes env but we'll overlay from file
//

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
	});
}

// capability name is optional - defaults to tool name
var checkWhich = function(cap: any, tool: string, capability?:string) {
	var toolpath = shell.which(tool);
	if (toolpath) {
		cap[capability || tool] = toolpath;
	}	
}

var checkTool = function(cap: any, command: string, args: string, capability: string) {
	var tool = shell.which(command);
	if (!tool) {
		return;
	}

	var val = shell.exec(command + ' ' + args, {silent:true}).output;
	if (val) {
		cap[capability] = val;
	}
}

var setIfNot = function(cap, name, val) {
	if (!cap.hasOwnProperty(name)) {
		cap[name] = val;
	}	
}

export function getCapabilities(): { [key: string]: string } {
	var cap: { [key: string]: string } = getFilteredEnv();

	checkWhich(cap, 'sh');
	checkWhich(cap, 'git');
	checkWhich(cap, 'npm');
	checkWhich(cap, 'node', 'node.js');
	checkWhich(cap, 'nodejs', 'node.js');
	checkWhich(cap, 'python');
	checkWhich(cap, 'python3');
	
	// we check for jake globally installed for path but if not, we package jake as part of this agent
	checkWhich(cap, 'jake');
	setIfNot(cap, 'jake', '.');

	checkWhich(cap, 'cmake');
    checkWhich(cap, 'ant');
	checkTool(cap, 'xcode-select', '-p', 'xcode');

	return cap;
}