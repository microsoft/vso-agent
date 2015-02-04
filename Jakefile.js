// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var fs = require('fs');
var path = require('path');
var shell = require('shelljs');
var mocha = require ('mocha');
var buildRoot = path.join(__dirname, '_build');
var buildPath = path.join(buildRoot, 'vsoxplat');
var packageRoot = path.join(__dirname, '_package');
var tarRoot = path.join(__dirname, '_tar');
var testRoot = path.join(__dirname, '_test');
var testPath = path.join(testRoot, 'test');
var packagePath = path.join(packageRoot, 'vsoxplat');

var writeHeader = function(title) {
	console.log();
	console.log('********** ' + title + ' **********');
}

desc('This is the default task.');
task('default', ['clean', 'package', 'tar'], function () {

});

desc('Build');
task('build', {async: true}, function () {	
	writeHeader('build');
	jake.rmRf(buildRoot);
	jake.mkdirP(buildPath);
	
	console.log('Compiling typescript to _build...');
	jake.exec(['tsc --outDir ' + buildPath + ' @sources'], {printStdout: true, printStderr: true}, function(){
		console.log('Compiling done');
		console.log('Copying other files');
		jake.cpR('package.json', buildPath);
		jake.cpR('src/agent/svc.sh', path.join(buildPath, 'agent'));
		jake.cpR('src/agent/handlers/vso.py', path.join(buildPath, 'agent', 'handlers'));
		jake.cpR('src/agent/plugins/build/lib/askpass.js', path.join(buildPath, 'agent', 'plugins', 'build', 'lib'));
		jake.cpR('src/bin/install.js', path.join(buildPath, 'bin'));
		
		complete();
	});
});

desc('Run tests')
task('test', ['default'], function(mode) {
	writeHeader('test');
	var useColors = true;
	if (mode) {
		console.log('mode: ' + mode);
		if (mode.toLowerCase() == 'ci') {
			useColors = false;
		}
	}
	console.log('Creating _test folder');
	jake.rmRf(testRoot);
	console.log('Copying files');
	jake.cpR(buildPath, testRoot);
	jake.cpR('src/test/messages', path.join(testRoot, 'test'));
	jake.cpR('src/test/projects', path.join(testRoot, 'test'));
	jake.cpR('src/test/tasks', path.join(testRoot, 'test'));
	jake.cpR(path.join(packagePath, 'agent'), testRoot);

	jake.mkdirP(path.join(testRoot, 'agent', 'work'));

	var runner = new mocha({reporter: 'spec', ui: 'bdd', useColors:useColors});

	fs.readdirSync(testPath).filter(function(file){
		return file.substr(-3) === '.js';
	}).forEach(function(file){
		runner.addFile(path.join(testPath, file));
	});

	runner.run(function(failures) {
		if (failures) {
			fail(failures);
		} else {
			complete();
		}
	});
});

desc('Drop build')
task('drop', [], function() {
	writeHeader('drop build');
	console.log('Dropping _build');
	jake.rmRf('_build');
	console.log('Dropping _package');
	jake.rmRf('_package');
	console.log('Dropping _tar');
	jake.rmRf('_tar');
	console.log('Dropping _test');
	jake.rmRf(testRoot);
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
	writeHeader('package');
	
	jake.rmRf(packageRoot);
	jake.mkdirP(packagePath);
	jake.cpR(buildPath, packageRoot);
	jake.cpR('README.md', path.join(packagePath));	
	console.log('Package created.');
});

desc('Create Tar')
task('tar', [], function() {
	writeHeader('create tar');

	console.log('Creating _tar/vsoxplat.tar');

	shell.rm('-rf', '_tar');
	shell.mkdir('_tar');
	console.log('copying agent...');
	shell.cp('-R', '_package/vsoxplat/agent', '_tar');
	shell.cp('_package/vsoxplat/package.json', '_tar/agent');
	shell.cd('_tar');
	console.log('creating tar...');
	shell.exec('tar czf vsoxplat.tar.gz agent');
	shell.cd('..');
	console.log('cleaning up...');
	shell.rm('-rf', '_tar/agent');

	console.log('done.');
});


