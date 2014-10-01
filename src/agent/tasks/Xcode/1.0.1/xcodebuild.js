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

var fs = require('fs')
  , path = require('path')
  , async = require('async')
  , shell = require('shelljs/global');

exports.execute = function(ctx, callback) {
	var xcbpath = which('xcodebuild');
	ctx.info('using xcodebuild: ' + xcbpath);

	var repoPath = ctx.variables['build.sourceDirectory'];

	//----------------------------------------------------------------------
	// Input Validation/Feedback
	//----------------------------------------------------------------------

	if (!xcbpath) {
		callback(new Error('xcodebuild not found'));
		return;
	}

	// optional - if you specify, must be valid path
	var xcWorkspacePath = ctx.inputs.xcWorkspacePath;
	if (xcWorkspacePath && !fs.existsSync(xcWorkspacePath)) {
		callback(new Error('xcWorkspacePath not found: ' + xcWorkspacePath));
		return;
	}

	// optional - if you specify, must be valid path
	var projectPath = ctx.inputs.projectPath;
	if (projectPath && !fs.existsSync(projectPath)) {
		callback(new Error('projectPath not found: ' + projectPath));
		return;
	}

	// SDK and Configuration are required
	var sdk = ctx.inputs.sdk;
	if (!sdk) {
		callback(new Error('sdk not specified'));
		return;		
	}

	var configuration = ctx.inputs.configuration;
	if (!configuration) {
		callback(new Error('sdk not specified'));
		return;		
	}

	// if it's a workspace build, scheme is required
	var scheme = ctx.inputs.scheme;
	if (xcWorkspacePath && !scheme) {
		callback(new Error('workspace builds need a scheme specified'));
		return;
	}

	var cwd = process.cwd();

	// create the output folder if not exist
	var outputFolder = path.join(cwd, 'output', ctx.inputs.outputPattern);
	ctx.info('outputFolder: ' + outputFolder);

	if (!fs.existsSync(outputFolder)) {
		mkdir('-p', outputFolder);
	}

	if (!fs.existsSync(outputFolder)) {
		callback(new Error('failed to create output folder: ' + outputFolder));
		return;	
	}

	//----------------------------------------------------------------------
	// Run xcodebuild
	//----------------------------------------------------------------------
/*
	https://developer.apple.com/library/mac/documentation/Darwin/Reference/ManPages/man1/xcodebuild.1.html

	xcodebuild -workspace ${INPUT_XCWORKSPACEPATH} \
	           -sdk ${INPUT_SDK} \
	           -scheme ${INPUT_SCHEME} \
	           -configuration ${INPUT_CONFIGURATION} \
	           DSTROOT=${OUTPUT_PATH}/build.dst \
	           OBJROOT=${OUTPUT_PATH}/build.obj \
	           SYMROOT=${OUTPUT_PATH}/build.sym \
	           SHARED_PRECOMPS_DIR=${OUTPUT_PATH}/build.pch
*/

	var args = []; 

	if (xcWorkspacePath && xcWorkspacePath != repoPath) {
		args.push('-workspace');
		args.push(xcWorkspacePath);
	}

	if (projectPath && projectPath != repoPath) {
		args.push('-project');
		args.push(projectPath);
	}

	args.push('-sdk');
	args.push(sdk);

	args.push('-configuration');
	args.push(configuration);


	if (scheme) {
		args.push('-scheme');
		args.push(scheme);
	}

	if (ctx.inputs.target) {
	    args.push(ctx.inputs.target);
	}

	// actions is optional - build is default
	if (ctx.inputs.actions) {
		args.push(ctx.inputs.actions);
	}

	// push variables for output
	args.push('DSTROOT=' + path.join(outputFolder, 'build.dst'));
	args.push('OBJROOT=' + path.join(outputFolder, 'build.obj'));
	args.push('SYMROOT=' + path.join(outputFolder, 'build.sym'));
	args.push('SHARED_PRECOMPS_DIR=' + path.join(outputFolder, 'build.pch'));
				
	ctx.info('xcodebuildargs:');
	ctx.info(xcbpath);
	args.forEach(function(arg) {
		ctx.info('   ' + arg);
	});

	var ops = {
		cwd: cwd,
		env: process.env
	};

	async.series([
		function(complete) {
			ctx.util.spawn(xcbpath, ['-version'], ops, function(err){ complete(err); });
		},
		function(complete) {
			ctx.util.spawn(xcbpath, args, ops, function(err){ complete(err); });
		}],
		function(err) {
			callback(err);
		});
}
