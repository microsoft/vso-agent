/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/toolrunner.d.ts"/>

var tl = require('vso-task-lib');
import cm = require('../../common');
import events = require('events');
import utilm = require('../../utilities');
import Q = require('q');
var shell = require('shelljs');
var path = require('path');
var xr = require('xmlreader');

export interface TfvcMapping {
    type: string;
    serverPath: string;
    localPath: string;
}

export interface TfvcWorkspace {
    name: string;
    mappings: TfvcMapping[];
}

export interface ITfvcConnOptions {
    username: string;
    password: string;
    collection: string;
}

export interface ITfvcExecOptions {
    cwd: string;
    env: { [key: string]: string };
    silent: boolean;
    outStream: NodeJS.WritableStream;
    errStream: NodeJS.WritableStream;
    failOnStdErr: boolean;
    ignoreReturnCode: boolean;
}

export class TfvcWrapper extends events.EventEmitter {
    constructor() {
        this.tfPath = shell.which('tf', false);
        this.connOptions = <ITfvcConnOptions>{};
        super();
    }

    public tfPath: string;
    public connOptions: ITfvcConnOptions;

    public setTfvcConnOptions(options: ITfvcConnOptions) {
        if (options) {
            this.connOptions = options;
        }
    }

    public getWorkspace(workspaceName: string): Q.Promise<TfvcWorkspace> {
        return this._shellExec('workspaces', ['-format:xml'])
        .then((ret) => {
            if (!this._success(ret)) {
                return null; 
            }

            //tf command returns non-xml text when there is no workspace
            var sanitize = function(output) {
                return output.slice(output.indexOf("<?xml"));
            }

            if (ret.output) {
                var workspace = null;
                xr.read(sanitize(ret.output), (err, res) => {
                    if (res && res.workspaces && res.workspaces.workspace) {
                        res.workspaces.workspace.each((i, ws) => { 
                            if (ws.attributes()['name'] === workspaceName) {
                                workspace = this._parseWorkspace(ws);
                            }
                        });
                    }
                });

                return workspace;
            }
        });
    }

    public deleteWorkspace(workspace: TfvcWorkspace): Q.Promise<number> {
        return this._exec('workspace', ['-delete', workspace.name]);
    }

    public newWorkspace(workspace: TfvcWorkspace): Q.Promise<number> {
        return this._exec("workspace", ['-new', '-permission:Private', '-location:local', workspace.name]);
    }

    public cloakFolder(serverPath: string, workspace: TfvcWorkspace): Q.Promise<number> {
        return this._exec('workfold', ['-cloak', serverPath, '-workspace:' + workspace.name]);
    }

    public mapFolder(serverPath: string, localPath: string, workspace: TfvcWorkspace): Q.Promise<number> {
        return this._exec('workfold', ['-map', serverPath, localPath, '-workspace:' + workspace.name]);
    }

    public unshelve(shelveset: string, workspace: TfvcWorkspace): Q.Promise<number> {
        return this._exec('unshelve', ['-recursive', '-format:detailed', '-workspace:' + workspace.name, shelveset]);
    }

    public get(version: string): Q.Promise<number> {
        return this._exec('get', ['.', '-recursive', '-version:' + version, '-noprompt']);
    }

    public undo(): Q.Promise<number> {
        return this._exec('undo', ['.', '-recursive']);
    }

    private _getQuotedArgsWithDefaults(args: string[]): string[] {
        // default connection related args
        var collectionArg = '-collection:' + this.connOptions.collection;
        var loginArg = '-login:' + this.connOptions.username + ',' + this.connOptions.password;

        var quotedArg = function(arg) {
            var quote = '"';
            if (arg.indexOf('"') > -1) {
                quote = '\'';
            }
            return quote + arg + quote;
        }

        return args.concat([collectionArg, loginArg]).map((a) => quotedArg(a));
    }

    private _scrubCredential(msg: string): string {
        if (msg && typeof msg.replace === 'function' 
                    && this.connOptions.password) {
            return msg.replace(this.connOptions.password, cm.MASK_REPLACEMENT);
        }

        return msg;
    }

    private _exec(cmd: string, args: string[], options?: ITfvcExecOptions): Q.Promise<number> {
        if (this.tfPath === null) {
            return this._getTfNotInstalled();
        }

        var tf = new tl.ToolRunner(this.tfPath);
        tf.silent = true;

        tf.on('debug', (message) => {
            this.emit('stdout', '[debug]' + this._scrubCredential(message));
        })

        tf.on('stdout', (data) => {
            this.emit('stdout', this._scrubCredential(data));
        })

        tf.on('stderr', (data) => {
            this.emit('stderr', this._scrubCredential(data));
        })

        // cmd
        tf.arg(cmd, true);

        var quotedArgs = this._getQuotedArgsWithDefaults(args);
        // args
        if (quotedArgs.map((arg: string) => {
            tf.arg(arg, true); // raw arg
        }));

        options = options || <ITfvcExecOptions>{};
        var ops: any = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: true,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false
        };

        return tf.exec(ops);
    }

    private _shellExec(cmd, args: string[]): Q.Promise<any> {
        if (this.tfPath === null) {
            return this._getTfNotInstalled();
        }

        var cmdline = 'tf ' + cmd + ' ' + this._getQuotedArgsWithDefaults(args).join(' ');
        return utilm.exec(cmdline);
    }

    private _parseWorkspace(xmlNode: any): TfvcWorkspace {
        var workspace: TfvcWorkspace = {
            name: xmlNode.attributes()['name'],
            mappings: []
        };

        if (xmlNode['working-folder']) {
            xmlNode['working-folder'].each((i, folder) => {
                // if mapping depth is one-level, add a wildcard to the end of the mapping
                // so it matches the input
                var serverPath: string = folder.attributes()['server-item'];
                var depth: string = folder.attributes()['depth'];
                if (depth && depth === 'one-level') {
                    serverPath = path.join(serverPath, "*");
                }
                workspace.mappings.push({
                    serverPath: serverPath,
                    localPath: folder.attributes()['local-item'],
                    type: folder.attributes()['type']
                });
            });
        }

        return workspace;
    }

    private _getTfNotInstalled(): Q.Promise<number>{
        var defer = Q.defer<number>();

        defer.reject(new Error("'tf' was not found. Please install the Microsoft Team Explorer Everywhere cross-platorm, command-line client and add 'tf' to the path.\n"
                + "Please also accept its End User License Agreement by running 'tf eula'.\n"
                + "See https://www.visualstudio.com/products/team-explorer-everywhere-vs.aspx \n"));

        return defer.promise;
    }

    private _success(ret): boolean {
        return ret && ret.code  === 0;
    }
}
