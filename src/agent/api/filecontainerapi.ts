// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/Q.d.ts" />

import Q = require('q');
import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');
import stream = require("stream");

export class FileContainerApi {
    collectionUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(collectionUrl: string, handler: ifm.IRequestHandler) {
        this.collectionUrl = collectionUrl;
        this.httpClient = new httpm.HttpClient('vso-build-api', handler);
        this.restClient = new restm.RestClient(collectionUrl, '1.0; res-version=3', this.httpClient);
    }

/*
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
*/

    public uploadFile(containerId: number, 
                      itemPath: string, 
                      contentStream: NodeJS.ReadableStream, 
                      contentIdentifier: Buffer, 
                      uncompressedLength: number, 
                      compressedLength: number, 
                      isGzipped: boolean,
                      onResult: (err: any, statusCode: number, item: ifm.FileContainerItem) => void): void {

        var targetUrl = "_apis/resources/containers/" + containerId + "/" + itemPath;

        var addtlHeaders = {};
        var byteLengthToSend = isGzipped ? compressedLength : uncompressedLength;

        addtlHeaders["Content-Range"] = "bytes 0-" + (byteLengthToSend - 1) + "/" + byteLengthToSend;
        addtlHeaders["Content-Length"] = byteLengthToSend;

        if (isGzipped) {
            addtlHeaders["Accept-Encoding"] = "gzip";
            addtlHeaders["Content-Encoding"] = "gzip";
            addtlHeaders["x-tfs-filelength"] = uncompressedLength;
        }

        if (contentIdentifier) {
            addtlHeaders["x-vso-contentId"] = contentIdentifier.toString("base64");
        }

        this.restClient.uploadStream('PUT', targetUrl, contentStream, addtlHeaders, (err: any, statusCode: number, obj: any) => {
            var item: ifm.FileContainerItem  = err ? null : this._deserializeFileContainerItem(obj);
            onResult(err, statusCode, item);
        });
    }

    private _deserializeFileContainerItem(item: ifm.FileContainerItem): ifm.FileContainerItem {
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

export class QFileContainerApi {
    _containerApi: ifm.IFileContainerApi;

    constructor(accountUrl:string, handler: ifm.IRequestHandler) {
        this._containerApi = new FileContainerApi(accountUrl, handler);
    }

    public uploadFile(containerId: number, 
                      itemPath: string, 
                      contentStream: NodeJS.ReadableStream, 
                      contentIdentifier: Buffer, 
                      uncompressedLength: number, 
                      compressedLength: number, 
                      isGzipped: boolean): Q.IPromise<ifm.FileContainerItem> {

        var deferred = Q.defer<ifm.FileContainerItem>();

        this._containerApi.uploadFile(containerId, 
            itemPath, 
            contentStream, 
            contentIdentifier, 
            uncompressedLength, 
            compressedLength, 
            isGzipped, (err: any, statusCode: number, item: ifm.FileContainerItem) => {
                if (err) {
                    err.statusCode = statusCode;
                    deferred.reject(err);
                } 
                else {
                    deferred.resolve(item);
                }
            });

        return deferred.promise;
    }
}
