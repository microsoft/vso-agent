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

var path = require('path');

var buildRoot = path.join(__dirname, '_build');
var buildPath = path.join(buildRoot, 'vsoxplat');
var packageRoot = path.join(__dirname, '_package');
var packagePath = path.join(packageRoot, 'vsoxplat');

desc('This is the default task.');
task('default', ['clean', 'package'], function () {

});

desc('Build');
task('build', {async: true}, function () {	
	jake.rmRf(buildRoot);
	jake.mkdirP(buildPath);
	
	console.log('Compiling typescript to _build...');
	jake.exec(['tsc --outDir ' + buildPath + ' @sources'], {printStdout: true, printStderr: true}, function(){
		console.log('Compiling done');
		console.log('Copying other files');
		jake.cpR('package.json', buildPath);
		jake.cpR('src/agent/handlers/vso.py', path.join(buildPath, 'agent', 'handlers'));
		jake.cpR('src/bin/install.js', path.join(buildPath, 'bin'));
		complete();
	});
});

desc('Drop build')
task('drop', [], function() {
	console.log('Dropping _build');
	jake.rmRf('_build');
	console.log('Dropping _package');
	jake.rmRf('_package');
	console.log('Dropping done.');
});

desc('Clean Build')
task('clean', ['drop', 'build'], function() {
	
});

desc('Update install from build')
task('update', {async: true}, function() {
	console.log('Updating _pkgPath');
	// TODO: windows?
	jake.exec(['rsync -tr ./_build/* ./_pkgPath'], {printStdout: true, printStderr: true}, function(){
		console.log('Update done.');
		complete();
	});
});

desc('Packaging')
task('package', [], function() {
	console.log('Creating Package...');	
	jake.rmRf(packageRoot);
	jake.mkdirP(packagePath);
	jake.cpR(buildPath, packageRoot);

	jake.cpR('src/agent/plugins', path.join(packagePath, 'agent', 'plugins'));

	// populate the task cache in work directory
	// TODO: this should go away after agent downloads tasks and they're all on the server
	jake.mkdirP(path.join(packagePath, 'agent', 'work'));
	jake.cpR('src/agent/tasks', path.join(packagePath, 'agent', 'work', 'tasks'));
	
	console.log('Package created.');
});

desc('Run host')
task('run', {async: true}, function() {
	console.log('Run host');
	jake.exec(['node ' + path.join('_pkgPath', 'host.js')], {printStdout: true, printStderr: true}, function(){
		console.log('Run done');
		complete();
	});
});

