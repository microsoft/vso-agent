// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import common = require('../../common');

export function pluginName() {
    return "Download artifacts";
}

// what shows in progress view
export function pluginTitle() {
    return "pluginTitle: Downloading artifacts";
}

export function beforeJob(context: common.IExecutionContext, callback) {
    context.info('Download artifacts initialized.');
    callback();
    return;
}