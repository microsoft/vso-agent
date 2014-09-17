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

import fs = require("fs");
import url = require("url");
import path = require("path");
import http = require("http");
import httpm = require("./httpclient");
import ifm = require('./interfaces');

/**
 * getJSON:  REST get request returning JSON object(s)
 * @param options: http options object
 * @param callback: callback to pass the results JSON object(s) back
 */

var getJsonResponse = function (contents) {
    var json = JSON.parse(contents);
    if (process.env.XPLAT_TRACE_HTTP) {
        console.log('********* RESPONSE ***********');
        console.log(JSON.stringify(json, null, 2));
        console.log('******************************');
    }
    return json;
}

var httpCodes = {
    300: "Multiple Choices",
    301: "Moved Permanantly",
    302: "Resource Moved",
    304: "Not Modified",
    305: "Use Proxy",
    306: "Switch Proxy",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    402: "Payment Required",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    406: "Not Acceptable",
    407: "Proxy Authentication Required",
    408: "Request Timeout",
    409: "Conflict",
    410: "Gone",
    500: "Internal Server Error",
    501: "Not Implemented",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout"
}

var processResponse = function (url, res, contents, onResult) {
    if (process.env.XPLAT_TRACE_HTTP) {
        console.log('********* RESPONSE ***********');
        console.log('statusCode: ' + res.statusCode);
        console.log('url: ' + url);
        console.log('time: ' + new Date());
        console.log('******************************');
    }

    if (res.statusCode > 299) {
        // not success
        var msg = httpCodes[res.statusCode] ? "Failed Request: " + httpCodes[res.statusCode] : "Failed Request";
        msg += '(' + res.statusCode + ') - ' + url;

        if (contents) {
            console.log(contents);
        }
        onResult(new Error(msg), res.statusCode, null);
    } else {
        try {
            var jsonObj = null;
            if (contents && contents.length > 0) {
                jsonObj = JSON.parse(contents);
                if (process.env.XPLAT_TRACE_HTTP) {
                    console.log(JSON.stringify(jsonObj, null, 2));
                }
            }
        } catch (e) {

            onResult(new Error('Invalid Resource'), res.statusCode, null);
            if (process.env.XPLAT_TRACE_HTTP) {
                console.log(contents);
            }
            return;
        }

        onResult(null, res.statusCode, jsonObj);
    }
};

export function enumToString(enumType: any, enumValue: number, camelCase: boolean) {
    var valueString = enumType[enumValue];

    if (valueString && camelCase) {
        if (valueString.length <= 1) {
            valueString = valueString.toLowerCase();
        }
        else {
            valueString = valueString.substring(0, 1).toLowerCase() + valueString.substring(1);
        }
    }

    return valueString;
}

export class RestClient implements ifm.IRestClient {
    baseUrl: string;
    basePath: string;
    httpClient: ifm.IHttpClient;

    constructor(baseUrl: string, httpClient: ifm.IHttpClient) {
        this.baseUrl = baseUrl;
        this.basePath = url.parse(baseUrl).pathname;
        this.httpClient = httpClient;
    }

    resolveUrl(relativeUrl: string): string {
        return url.resolve(this.baseUrl, path.join(this.basePath, relativeUrl));
    }

    getJson(relativeUrl: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._getJson('GET', relativeUrl, onResult);
    }

    getJsonWrappedArray(relativeUrl: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this.getJson(relativeUrl, (err: any, statusCode: number, obj: any) => {
            if (err) {
                onResult(err, statusCode, null);
            } else {
                if (obj['value'] instanceof Array) {
                    onResult(null, statusCode, obj['value']);
                } else {
                    onResult(null, statusCode, obj);
                }
            }
        });
    }

    delete(relativeUrl: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._getJson('DELETE', relativeUrl, onResult);
    }

    create(relativeUrl: string, resources: any, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._sendJson('POST', relativeUrl, resources, onResult);
    }

    createJsonWrappedArray(relativeUrl: string, resources: any[], onResult: (err: any, statusCode: number, resources: any[]) => void): void {
        this._sendWrappedJson('POST', relativeUrl, resources, onResult);
    }

    update(relativeUrl: string, resources: any, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._sendJson('PATCH', relativeUrl, resources, onResult);
    }

    updateJsonWrappedArray(relativeUrl: string, resources: any[], onResult: (err: any, statusCode: number, resources: any[]) => void): void {
        this._sendWrappedJson('PATCH', relativeUrl, resources, onResult);
    }

    uploadFile(relativeUrl: string, filePath: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        if (process.env.XPLAT_TRACE_HTTP) {
            console.log('======= uploadFile =========');
            console.log(filePath);
            console.log(relativeUrl);
            console.log('=========================');
        }

        fs.stat(filePath, (err, stats) => {
            if (err) {
                onResult(err, 400, null);
                return;
            }

            var postUrl = this.resolveUrl(relativeUrl);
            var contentStream: ReadableStream = fs.createReadStream(filePath);

            var headers = {};
            headers["Accept"] = 'application/json';
            headers["Content-Length"] = stats.size;

            this.httpClient.sendFile('POST', postUrl, contentStream, headers, (err: any, res: ifm.IHttpResponse, contents: string) => {
                if (err) {
                    if (process.env.XPLAT_TRACE_HTTP) {
                        console.log('ERR: ' + err.message + ':' + err.statusCode);
                    }
                    onResult(err, err.statusCode, null);
                    return;
                }

                processResponse(postUrl, res, contents, onResult);
            });
        });


    }

    replace(relativeUrl: string, resources: any, onResult: (err: any, statusCode: number, obj: any) => void): void {
        this._sendJson('PUT', relativeUrl, resources, onResult);
    }

    _sendWrappedJson(verb: string, relativeUrl: string, resources: any[], onResult: (err: any, statusCode: number, resources: any[]) => void): void {
        var wrapped = {
            count: resources.length,
            value: resources
        }

        this._sendJson(verb, relativeUrl, wrapped, (err: any, statusCode: number, obj: any) => {
            if (err) {
                onResult(err, statusCode, null);
            } else {
                var val = obj ? obj.value : obj;
                onResult(null, statusCode, val);
            }
        });
    }

    _getJson(verb: string, relativeUrl: string, onResult: (err: any, statusCode: number, obj: any) => void): void {
        var getUrl = this.resolveUrl(relativeUrl);

        var headers = {};
        headers["Accept"] = 'application/json';
        this.httpClient.get(verb, getUrl, headers, (err: any, res: ifm.IHttpResponse, contents: string) => {
            if (err) {
                if (process.env.XPLAT_TRACE_HTTP) {
                    console.log('ERR: ' + err.message + ':' + err.statusCode);
                }
                onResult(err, err.statusCode, null);
                return;
            }

            processResponse(getUrl, res, contents, onResult);
        });
    }

    _sendJson(verb: string, relativeUrl: string, data: any, onResult: (err: any, statusCode: number, obj: any) => void): void {
        var postUrl = this.resolveUrl(relativeUrl);

        var headers = {};
        headers["Accept"] = 'application/json';
        headers["Content-Type"] = 'application/json; charset=utf-8';

        this.httpClient.send(verb, postUrl, data, headers, (err: any, res: ifm.IHttpResponse, contents: string) => {
            if (err) {
                if (process.env.XPLAT_TRACE_HTTP) {
                    console.log('ERR: ' + err.message + ':' + err.statusCode);
                }
                onResult(err, err.statusCode, null);
                return;
            }

            processResponse(postUrl, res, contents, onResult);
        });
    }

    // TODO: postJsonWrappedArray
}
