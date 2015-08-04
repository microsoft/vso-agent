// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

var path = require('path');
var os = require('os');

import cm = require('./common');

export class Tracing {
    constructor(fullPath: string, writer: cm.ITraceWriter) {
        var ext = path.extname(fullPath);
        this.scope = path.basename(fullPath, ext);
        this.writer = writer;
    }

    public location: string;
    private scope: string;
    private writer: cm.ITraceWriter;

    public enter(location: string) {
        this.write(location + '>>>>>>>>>> ');
    }

    public callback(location: string) {
        this.write(location + '<<<<<<<<<< ');
    }

    public state(name: string, data: any) {
        this.write(name + ':' + JSON.stringify(data, null, 2));
    }

    public write(message: string) {
        this.writer.trace('[' + new Date().toISOString()  + '] ' + this.scope + ':' + '> ' + message + os.EOL);
    }

    public error(message: string) {
        this.write('[Error] ' + message);
    }
}
