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

import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');

export class BuildApi implements ifm.IBuildApi {
	collectionUrl: string;
	httpClient: httpm.HttpClient;
	restClient: restm.RestClient;

	constructor(collectionUrl:string, handler: ifm.IRequestHandler) {
		this.collectionUrl = collectionUrl;
		this.httpClient = new httpm.HttpClient('vso-build-api', handler);
		this.restClient = new restm.RestClient(collectionUrl, this.httpClient);		
	}

	//
	// TODO: do options request to avoid path math
	//

}
