// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../definitions/Q.d.ts" />

import Q = require('q');
import ifm = require('./interfaces');
import httpm = require('./httpclient');
import restm = require('./restclient');
import stream = require("stream");

export enum ContainerItemType {
    Any = 0,
    Folder = 1,
    File = 2
}

/*
export interface FileContainerItem {
    containerId: number;
    itemType: ContainerItemType;
    path: string;
    contentId?: string;
    fileLength?: number;
}
*/

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
        addtlHeaders["Content-Range"] = "bytes 0-" + (uncompressedLength - 1) + "/" + uncompressedLength;

        if (isGzipped) {
            addtlHeaders["Accept-Encoding"] = "gzip";
            addtlHeaders["Content-Encoding"] = "gzip";
            addtlHeaders["x-tfs-filelength"] = compressedLength;
            headers["Content-Length"] = compressedLength;
        }
        else {
            headers["Content-Length"] = uncompressedLength;
        }

        if (contentIdentifier) {
            headers["x-vso-contentId"] = contentIdentifier.toString("base64");
        }

        this.restClient.uploadStream(targetUrl, contentStream, addtlheaders, (err: any, statusCode: number, obj: any) => {
            FileContainerItem item = err ? null : this._deserializeFileContainerItem(obj);
            onResult(err, statusCode, item);
        });
    }

    private _deserializeFileContainerItem(item: ifm.FileContainerItem): FileContainerItem {
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
    containerApi: ifm.IFileContainerApi;

    constructor(accountUrl:string, handler: ifm.IRequestHandler) {
        this.containerApi = new FileContainerApi(accountUrl, handler);
    }

    public uploadFile(containerId: number, 
                      itemPath: string, 
                      contentStream: NodeJS.ReadableStream, 
                      contentIdentifier: Buffer, 
                      uncompressedLength: number, 
                      compressedLength: number, 
                      isGzipped: boolean): Q.IPromise<ifm.FileContainerItem> {
        
        var deferred = Q.defer<FileContainerItem>();

        containerApi.uploadFile(containerId, 
            itemPath, 
            contentStream, 
            contentIdentifier, 
            uncompressedLength, 
            compressedLength, 
            isGzipped, (err: any, statusCode: number, item: FileContainerItem) => {
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
