// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// q promise wrapper for agent api

import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');
import agentm = require('./agentapi');

var Q = require('q');

export interface IApiResult {
    statusCode: number;
    resource: any;
}

export class QAgentApi {
	agentApi: ifm.IAgentApi;

	constructor(accountUrl:string, handler: ifm.IRequestHandler) {
		this.agentApi = new agentm.AgentApi(accountUrl, handler);
	}

	connect() {
		var defer = Q.defer();

		this.agentApi.connect(function(err: any, statusCode: number, obj: any) {
			if (err) {
				err.statusCode = statusCode;
				defer.reject(err);
			}
			else {
				defer.resolve(obj);
			}
		});

		return defer.promise;		
	}
}