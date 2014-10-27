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

/// <reference path="../../definitions/Q.d.ts" />

import ifm = require('../../api/interfaces');
import httpm = require('../../api/httpclient');
import restm = require('../../api/restclient');
import Q = require("q");
import stream = require("stream");

export enum ContainerItemType {
    Any = 0,
    Folder = 1,
    File = 2
}

export interface FileContainerItem {
    containerId: number;
    itemType: ContainerItemType;
    path: string;
    contentId?: string;
    fileLength?: number;
}

export class FileContainerApi {
    collectionUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(collectionUrl: string, handler: ifm.IRequestHandler) {
        this.collectionUrl = collectionUrl;
        this.httpClient = new httpm.HttpClient('vso-build-api', handler);
        this.restClient = new restm.RestClient(collectionUrl, '1.0; res-version=3', this.httpClient);
    }

    public createItems(containerId: number, items: FileContainerItem[]): Q.IPromise<FileContainerItem[]> {
        var deferred = Q.defer<FileContainerItem[]>();

        this.restClient.createJsonWrappedArray("_apis/resources/containers/" + containerId, items, (err: any, statusCode: number, obj: any) => {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(obj.map((item) => this._deserializeFileContainerItem(item)));
            }
        });

        return deferred.promise;
    }

    public uploadFile(containerId: number, itemPath: string, contentStream: NodeJS.ReadableStream, contentIdentifier: Buffer, uncompressedLength: number, compressedLength: number, isGzipped: boolean): Q.IPromise<FileContainerItem> {
        var deferred = Q.defer<FileContainerItem>();

        var targetUrl = "_apis/resources/containers/" + containerId + "/" + itemPath;

        var headers = {};
        headers["Accept"] = 'application/json; api-version=' + this.restClient.apiVersion;
        headers["Content-Range"] = "bytes 0-" + (uncompressedLength - 1) + "/" + uncompressedLength;

        if (isGzipped) {
            headers["Accept-Encoding"] = "gzip";
            headers["Content-Encoding"] = "gzip";
            headers["x-tfs-filelength"] = compressedLength;
            headers["Content-Length"] = compressedLength;
        }
        else {
            headers["Content-Length"] = uncompressedLength;
        }

        if (contentIdentifier) {
            headers["x-vso-contentId"] = contentIdentifier.toString("base64");
        }

        // TODO: support chunks
        this.httpClient.sendFile('PUT', this.restClient.resolveUrl(targetUrl), contentStream, headers, (err: any, res: ifm.IHttpResponse, contents: string) => {
            if (err) {
                if (process.env.XPLAT_TRACE_HTTP) {
                    console.log('ERR: ' + err.message + ':' + err.statusCode);
                }
                deferred.reject(err);
            }

            restm.processResponse(targetUrl, res, contents, (err: any, statusCode: number, obj: any) => {
                if (err) {
                    deferred.reject(err);
                }
                else {
                    deferred.resolve(this._deserializeFileContainerItem(obj));
                }
            });
        });

        return deferred.promise;
    }

    private _deserializeFileContainerItem(item: FileContainerItem): FileContainerItem {
        item.itemType = TypeInfo.ContainerItemType.enumValues[item.itemType];

        return item;
    }
}

var TypeInfo = {
    ContainerItemType: {
        enumValues: {
            "any": 0,
            "folder": 1,
            "file": 2
        }
    }
}