// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import context = require('../../context');

export function pluginName() {
    return "Download artifacts";
}

// what shows in progress view
export function pluginTitle() {
    return "pluginTitle: Downloading artifacts";
}

export function beforeJob(context: context.JobContext, callback) {
    context.info('Download artifacts initialized.');
    callback();
    return;
}