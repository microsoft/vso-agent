// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/// <reference path="../../definitions/Q.d.ts" />

import ifm = require('../../api/interfaces');
import httpm = require('../../api/httpclient');
import restm = require('../../api/restclient');
import Q = require("q");

export interface ArtifactResource {
    data: string;
    downloadUrl?: string;
    type?: ArtifactResourceType;
    url?: string;
}

export enum ArtifactResourceType {
    Unknown = 0,
    LocalPath = 1,
    VersionControl = 2,
    Container = 3,
}

export interface BuildArtifact {
    id?: number;
    name: string;
    resource: ArtifactResource;
}

export class BuildApi {
    collectionUrl: string;
    httpClient: httpm.HttpClient;
    restClient: restm.RestClient;

    constructor(collectionUrl: string, handler: ifm.IRequestHandler) {
        this.collectionUrl = collectionUrl;
        this.httpClient = new httpm.HttpClient('vso-build-api', handler);
        this.restClient = new restm.RestClient(collectionUrl, '2.0-preview', this.httpClient);
    }

    //
    // TODO: do options request to avoid path math
    //       or replace this with the auto-generated typescript client
    //

    public postArtifact(buildId: number, artifact: BuildArtifact): Q.IPromise<BuildArtifact> {
        var deferred = Q.defer<BuildArtifact>();

        this.restClient.create("_apis/build/builds/" + buildId + "/artifacts", artifact, (err: any, statusCode: number, obj: any) => {
            if (err) {
                deferred.reject(err);
            }
            else {
                deferred.resolve(obj);
            }
        });

        return deferred.promise;
    }
}
