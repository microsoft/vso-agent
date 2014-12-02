// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var fs = require('fs');
var path = require('path');
var iniparser = require('iniparser');
var url = require('url');

exports.urlWithUserName = function(username, repoUrl) {
	console.log('adding: ' + username + ' to ' + repoUrl);
	var parsed = url.parse(repoUrl);
	parsed.auth = username;
	return url.format(parsed);
}

exports.translateRef = function(ref) {
	var brPre = 'refs/heads/';
	if (ref.startsWith(brPre)) {
		ref = 'refs/remotes/origin/' + ref.substr(brPre.length, ref.length - brPre.length);
	}

	return ref;
}

exports.repoExists = function(repoPath) {
	var repoGitPath = path.join(repoPath, '.git');
	return fs.existsSync(repoGitPath);	
}

exports.isRepoOriginUrl = function(repoPath, url) {
	var isMatch = false;
	var configPath = path.join(repoPath, '.git', 'config');

	if (fs.existsSync(configPath)) {
		var config = iniparser.parseSync(configPath);
		isMatch = config.hasOwnProperty('remote "origin"') && 
					url.isEqual(true, config['remote "origin"'].url);
	}

	return isMatch;
}
