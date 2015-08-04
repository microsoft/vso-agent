// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/Q.d.ts" />
/// <reference path="../definitions/vso-node-api.d.ts" />

import Q = require('q');
import ifm = require('./interfaces');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import httpm = require('vso-node-api/HttpClient');
import restm = require('vso-node-api/RestClient');
import stream = require("stream");
import querystring = require('querystring');

export class FileContainerApi {
    collectionUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(collectionUrl: string, handlers: baseifm.IRequestHandler[]) {
        this.collectionUrl = collectionUrl;
        this.httpClient = new httpm.HttpClient('vso-build-api', handlers);
        this.restClient = new restm.RestClient(this.httpClient);
    }

/*
    public createItems(containerId: number, items: FileContainerItem[]): Q.Promise<FileContainerItem[]> {
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

        var itemPathQS: string = querystring.stringify({itemPath: itemPath});
        var targetUrl = "_apis/resources/containers/" + containerId + "?" + itemPathQS;

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

        this.restClient.uploadStream('PUT', targetUrl, "3.0-preview-1", contentStream, addtlHeaders, null, (err: any, statusCode: number, obj: any) => {
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

    constructor(accountUrl:string, handlers: baseifm.IRequestHandler[]) {
        this._containerApi = new FileContainerApi(accountUrl, handlers);
    }

    public uploadFile(containerId: number, 
                      itemPath: string, 
                      contentStream: NodeJS.ReadableStream, 
                      contentIdentifier: Buffer, 
                      uncompressedLength: number, 
                      compressedLength: number, 
                      isGzipped: boolean): Q.Promise<ifm.FileContainerItem> {

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
