// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cm = require('../../agent/common');
import baseifm = require('vso-node-api/interfaces/common/VsoBaseInterfaces');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');

export class TestJobInfo implements cm.IJobInfo {
    constructor(variables: { [key: string]: string }) {
        this.variables = variables;
    }
    public description: string;
    public jobId: string;
    public jobMessage: agentifm.JobRequestMessage;
    public planId: string;
    public timelineId: string;
    public requestId: number;
    public lockToken: string;
    public systemAuthHandler: baseifm.IRequestHandler;
    public variables: { [key: string]: string };
    public mask: (input: string) => string;
}