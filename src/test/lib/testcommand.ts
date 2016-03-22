// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import cm = require('../../agent/common');

export class TestCommand implements cm.ITaskCommand {
    constructor(command: string, properties: { [name: string]: string }, message: string) {
        this.command = command;
        this.properties = properties;
        this.message = message;
        this.lines = [];
    }

    public lines: string[];
    public command: string;
    public properties: { [name: string]: string };
    public message: string;

    public info(message: string) {
        console.log(message);
    }

    public warning(message: string) {
        console.log(message);
    }

    public error(message: string) {
        console.log(message);
    }
}