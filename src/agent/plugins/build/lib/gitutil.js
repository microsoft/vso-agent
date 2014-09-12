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
