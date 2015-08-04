/// <reference path="./node.d.ts" />
/// <reference path="./Q.d.ts" />
import Q = require('q');
import events = require('events');
export interface IExecOptions {
    cwd: string;
    env: {
        [key: string]: string;
    };
    silent: boolean;
    failOnStdErr: boolean;
    ignoreReturnCode: boolean;
    outStream: NodeJS.WritableStream;
    errStream: NodeJS.WritableStream;
}
export declare function debug(message: any): void;
export declare class ToolRunner extends events.EventEmitter {
    constructor(toolPath: any);
    toolPath: string;
    args: string[];
    silent: boolean;
    private _debug(message);
    arg(args: any, raw: any): void;
    exec(options: IExecOptions): Q.Promise<{}>;
}
