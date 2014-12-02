// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/node.d.ts"/>

import fs = require("fs");
import url = require("url");
import path = require("path");
import http = require("http");
import shell = require("shelljs");
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

export function processResponse(url, res, contents, onResult) {
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
    apiVersion: string;
    httpClient: ifm.IHttpClient;

    constructor(baseUrl: string, apiVersion: string, httpClient: ifm.IHttpClient) {
        this.baseUrl = baseUrl;
        this.basePath = url.parse(baseUrl).pathname;
        this.httpClient = httpClient;
        this.apiVersion = apiVersion;
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
            var contentStream: NodeJS.ReadableStream = fs.createReadStream(filePath);

            var headers = {};
            headers["Accept"] = 'application/json; api-version=' + this.apiVersion;
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

    downloadFile(relativeUrl: string, filePath: string, fileType: string, onResult: (err: any, statusCode: number) => void): void {
        if (process.env.XPLAT_TRACE_HTTP) {
            console.log('======= downloadFile =========');
            console.log(filePath);
            console.log(relativeUrl);
            console.log('=========================');
        }

        if (fs.existsSync(filePath)) {
            onResult(new Error('File ' + filePath + ' already exists.'), null);
            return;
        }

        var getUrl = this.resolveUrl(relativeUrl);
        var fileStream: NodeJS.WritableStream = fs.createWriteStream(filePath);

        var headers = {};
        headers["Accept"] = fileType + '; api-version=' + this.apiVersion;

        this.httpClient.getFile(getUrl, fileStream, headers, (err: any, res: ifm.IHttpResponse) => {
            if (err) {
                shell.rm('-rf', filePath);
                onResult(err, err.statusCode);
            } else if(res.statusCode > 299) {
                shell.rm('-rf', filePath);
                onResult(new Error('Unable to download file'), res.statusCode);
            } else {
                onResult(null, res.statusCode);
            }
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
        headers["Accept"] = 'application/json; api-version=' + this.apiVersion;
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
        headers["Accept"] = 'application/json; api-version=' + this.apiVersion;
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
