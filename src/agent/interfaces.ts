// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// ---------------------------------------------------------------------------
// API Client Interfaces
//----------------------------------------------------------------------------

/// <reference path="./definitions/node.d.ts" />
/// <reference path="./definitions/Q.d.ts" />

import fcifm = require('vso-node-api/interfaces/FileContainerInterfaces');
import testifm = require('vso-node-api/interfaces/TestInterfaces');

//-----------------------------------------------------
// FileContainer Api
//-----------------------------------------------------

export interface FileContainerItemInfo {
    fullPath: string;
    containerItem?: fcifm.FileContainerItem;
    uploadHeaders?: { [header: string]: any; };
}

// ---------------------------------------------------------------------------
// Job Message Interfaces
//----------------------------------------------------------------------------

export interface TaskInputs {
    [key: string]: string;
}

export interface JobVariables {
    [key: string]: string;
}

//-----------------------------------------------------
// TestManagement Api
//-----------------------------------------------------

export interface TestRunWithResults {
    testRun: testifm.RunCreateModel;
    testResults: testifm.TestResultCreateModel[];
}
