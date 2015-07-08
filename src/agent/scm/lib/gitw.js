#!/usr/bin/env node

//
// gitw commandline allows testing running git 
//

var gitwm = require('./gitwrapper');

var gitw = new gitwm.GitWrapper();
var args = process.argv.length > 2 ? process.argv.slice(2) : ['help'];

gitw.on('stdout', function(data) {
	console.log('stdout: ' + data.toString());
})

gitw.on('stderr', function(data) {
	console.log('stderr: ' + data.toString());
})

if (process.env['GIT_USERNAME']) {
	gitw.username = process.env['GIT_USERNAME'];
}

if (process.env['GIT_PASSWORD']) {
	gitw.password = process.env['GIT_PASSWORD'];
}

gitw.exec(args, { useGitExe: true })
.then(function(code) {
	console.log('code: ' + code);
});