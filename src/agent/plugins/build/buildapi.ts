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
        this.restClient = new restm.RestClient(collectionUrl, '2.0', this.httpClient);
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
