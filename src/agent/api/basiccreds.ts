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

/// <reference path="../definitions/node.d.ts"/>

import ifm = require('./interfaces');

export class BasicCredentialHandler implements ifm.IRequestHandler {
	username: string;
	password: string;

	constructor(username: string, password: string) {
		this.username = username;
		this.password = password;
	}

    // currently implements pre-authorization
	// TODO: support preAuth = false where it hooks on 401
	prepareRequest(options:any): void {
		// console.log(this.username + ':' + this.password);
		options.headers['Authorization'] = 'Basic ' + new Buffer(this.username + ':' + this.password).toString('base64');
		options.headers['X-TFS-FedAuthRedirect'] = 'Suppress';
	}
}
