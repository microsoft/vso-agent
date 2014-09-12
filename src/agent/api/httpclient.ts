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

import url = require("url");

import http = require("http");
import https = require("https");
import ifm = require('./interfaces');

http.globalAgent.maxSockets = 100;

export class HttpClient implements ifm.IHttpClient {
    userAgent: string;
    handler: ifm.IRequestHandler;

    constructor(userAgent: string, handler?: ifm.IRequestHandler) {
        this.userAgent = userAgent;
        this.handler = handler;
    }

    get(verb: string, requestUrl: string, headers: any, onResult: (err: any, res: http.ClientResponse, contents: string) => void): void {
        var options = this._getOptions(verb, requestUrl, headers);
        this.request(options.protocol, options.options, null, onResult);
    }

    // POST, PATCH, PUT
    send(verb: string, requestUrl: string, objs: any, headers: any, onResult: (err: any, res: http.ClientResponse, contents: string) => void): void {
        var options = this._getOptions(verb, requestUrl, headers);
        this.request(options.protocol, options.options, objs, onResult);
    }

    sendFile(verb: string, requestUrl: string, content: ReadableStream, headers: any, onResult: (err: any, res: http.ClientResponse, contents: string) => void): void {
        var options = this._getOptions(verb, requestUrl, headers);

        var req = options.protocol.request(options.options, function (res) {
            var output = '';

            res.on('data', function (chunk) {
                output += chunk;
            });

            res.on('end', function () {
                // res has statusCode and headers
                onResult(null, res, output);
            });
        });

        req.on('error', function (err) {
            // err has statusCode property
            // res should have headers
            onResult(err, null, null);
        });

        content.on('close', function () {
            req.end();
        });

        content.pipe(req);
    }

    _getOptions(method: string, requestUrl: string, headers: any): any {

        // TODO: implement http tracing
        // console.log(requestUrl);

        var parsedUrl: url.Url = url.parse(requestUrl);
        var usingSsl = parsedUrl.protocol === 'https:';
        var prot: any = usingSsl ? https : http;
        var defaultPort = usingSsl ? 443 : 80;

        var options = {
            host: parsedUrl.hostname,
            port: parsedUrl.port || defaultPort,
            path: (parsedUrl.pathname || '') + (parsedUrl.search || ''),
            method: method,
            headers: {}
        }

        options.headers = headers;

        //options.headers["Accept"] = contentType;
        options.headers["User-Agent"] = this.userAgent;

        if (this.handler) {
            this.handler.prepareRequest(options);
        }

        return {
            protocol: prot,
            options: options,
        };
    }

    // _handleSend
    // options.headers["Content-Type"] = contentType;

    request(protocol: any, options: any, objs: any, onResult: (err: any, res: http.ClientResponse, contents: string) => void): void {
        var reqData;

        if (objs) {
            reqData = JSON.stringify(objs, null, 2);
            options.headers["Content-Length"] = reqData.length;  // new Buffer(reqData, 'utf8').length;
        }

        if (process.env.XPLAT_TRACE_HTTP) {
            console.log('======= REQUEST =========');
            console.log(JSON.stringify(options, null, 2));

            if (reqData)
                console.log(reqData);
            console.log('=========================');
        }

        var req = protocol.request(options, function (res) {
            var output = '';
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                output += chunk;
            });

            res.on('end', function () {
                // res has statusCode and headers
                onResult(null, res, output);
            });
        });

        req.on('error', function (err) {
            // err has statusCode property
            // res should have headers
            onResult(err, null, null);
        });

        if (reqData) {
            req.write(reqData, 'utf8');
        }

        req.end();
    }
}
