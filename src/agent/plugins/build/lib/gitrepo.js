// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

var shell = require('shelljs/global');
var path = require('path');
var fs = require('fs');
var async = require('async');
var gitutil = require('./gitutil');

var checkShellError = function(callback) {
	if (error()) {
		callback(new Error(error()));
	}		
}

exports.getcode = function(ctx, options, callback) {
	ctx.info('cwd: ' + process.cwd());

	var git = which('git');
	if (!git) {
		callback(new Error('git is not installed'));
	}
	ctx.info('Using: ' + git);
	
	ctx.info('Repo: ' + options.repoLocation);
	var inputref = "master";
	if (options.ref && options.ref.trim().length) {
		inputref = options.ref;
	}

	// TODO: (bryanmac) Pull auth from context and/or task - anonymous repo right now.
	// TODO: replace $(definitionId) from vars.  Done on all inputs before it gets to task

	var repoPath = path.resolve(options.localPath);
	ctx.info('Repo path: ' + repoPath);

	// if branch, we want to clone remote branch name to avoid tracking etc.. ('/refs/remotes/...')
	var ref = gitutil.translateRef(inputref);
	ctx.info('Using ref: ' + ref);

	var askpass = null;
	if (options.creds) {
		var askPath = path.join(__dirname, 'askpass.js');
		// TODO: should be some sort of config as part of pulling down task.
		chmod('u+x', askPath);

		askpass = 'core.askpass=' + path.join(__dirname, 'askpass.js');
		options.repoLocation = gitutil.urlWithUserName(options.creds.username, options.repoLocation);
		ctx.info('new repo location:' + options.repoLocation);
	}

	console.log('askpass: ' + askpass);
	console.log('pass:' + process.env.altpassword);
	
	var repoDirName = path.dirname(repoPath);
	if (!fs.existsSync (repoDirName)) {
		ctx.info('Creating repo dir: ' + repoDirName)
		mkdir('-p', repoDirName);
		checkShellError(callback);
	}
	cd(repoDirName);
	ctx.info('cwd: ' + process.cwd());

	var repoFolder = path.basename(repoPath);

	var repoExists = gitutil.repoExists(repoPath);
	if (repoExists) {
		if (!gitutil.isRepoOriginUrl(repoPath, options.repoLocation)) {
			callback(new Error('Repo @ ' + repoPath + ' is not ' + options.repoLocation));
			return;
		}
	}

	var handle = function(err, complete) {
		if (err) { complete(err); }
		complete();	
	}

	async.series([
		function(complete) {
			ctx.util.spawn('git', ['--version'], {}, function(err){ handle(err, complete); });
		},
		function(complete) {
			if (repoExists) {
				ctx.section('Git fetch');
				cd(repoPath);
				ctx.info('cwd: ' + process.cwd());
				checkShellError(complete);
				ctx.util.spawn('git', ['fetch'], { failOnStdErr: false }, function(err){ handle(err, complete); });
			}
			else {
				ctx.section('Git clone ' + options.repoLocation);
				ctx.info('Cloning into folder: ' + repoFolder);
				ctx.util.spawn('git', ['clone', '--progress', options.repoLocation, repoFolder, '-c', askpass], { failOnStdErr: false }, function(err){
					if (err) {
						complete(err);
					}
					else {
						cd(repoPath);
						checkShellError(complete);
						handle(err, complete);
					}
				});
			}
		},
		function(complete) {
			ctx.section('Git checkout ' + ref + ' ...');
			ctx.util.spawn('git', ['checkout', ref], { failOnStdErr: false }, function(err){ handle(err, complete); });
		},
		function(complete) {
			if (options.submodules) {
				ctx.section('Git submodule init ...');
				ctx.util.spawn('git', ['submodule', 'init'], { failOnStdErr: false }, function(err){ handle(err, complete); });
			}
			else {
				complete(null);
			}
		},
		function(complete) {
			if (options.submodules) {
				ctx.section('Git submodule update ...');
				ctx.util.spawn('git', ['submodule', 'update'], { failOnStdErr: false }, function(err){ handle(err, complete); });
			}
			else {
				complete(null);
			}
		}		
	], 
	// on complete 
	function(err) {
		if (err) { callback(err); }
		callback();
	});
}
