/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/toolrunner.d.ts"/>

var tl = require('vso-task-lib');
import events = require('events');
import cm = require('../../common');
import utilm = require('../../utilities');
import Q = require('q');
import os = require("os");
var shell = require('shelljs');
var path = require('path');
var xmlrReader = require('xmlreader');

var administrativeDirectoryName = ".svn";

export interface SvnMappingDetails {
    serverPath: string;
    localPath: string;
    revision: string;
    depth: string;
    ignoreExternals: boolean;
}

export interface SvnWorkspace {
    mappings: SvnMappingDetails[];
}

export interface ISvnMappingDictionary { [path: string]: SvnMappingDetails }

export interface ISvnConnectionEndpoint {
    username: string;
    password: string;
    realmName: string;
    url: string;
}

export interface ISvnExecOptions {
    cwd: string;
    env: { [key: string]: string };
    silent: boolean;
    outStream: NodeJS.WritableStream;
    errStream: NodeJS.WritableStream;
    failOnStdErr: boolean;
    ignoreReturnCode: boolean;
}

export class SvnWrapper extends events.EventEmitter {
    constructor() {
        this.svnPath = shell.which('svn', false);
        this.endpoint = <ISvnConnectionEndpoint>{};
        super();
    }

    public svnPath: string;
    public endpoint: ISvnConnectionEndpoint;

    public setSvnConnectionEndpoint(endpoint: ISvnConnectionEndpoint) {
        if (endpoint) {
            this.endpoint = endpoint;
        }
    }

    public getOldMappings(rootPath: string): Q.Promise<cm.IStringDictionary> {
        if (shell.test("-f", rootPath)) {
            throw new Error("The file " + rootPath + " already exists.");
        }

        var mappings: cm.IStringDictionary = <cm.IStringDictionary>{}; 

        if (shell.test("-d", rootPath)) {
            this._getSvnWorkingCopyPaths(rootPath)
            .then((workingDirectoryPaths: string[]) => {
                if (workingDirectoryPaths) {
                    workingDirectoryPaths.forEach((workingDirectoryPath: string) => {
                        this.svnInfo(workingDirectoryPath)
                        .then((info) => {
                            if (info && info.url) {
                                mappings[workingDirectoryPath] = info.url;
                            }
                        });
                    });
                }
            });
        }
        
        return Q(mappings);
    }
    
    private _getSvnWorkingCopyPaths(rootPath: string): Q.Promise<string[]> {
        if (shell.test("-d", path.join(rootPath, administrativeDirectoryName))) {
            // The rootPath contains .svn subfolder and we treat it as
            // a working copy candidate.  
            return Q([rootPath]);
        }
        else {
            var candidates: string[] = []; 
            
            var addRange = function(from: Q.Promise<string[]>) {
                from.then((workingCopyPaths: string[]) => {
                    workingCopyPaths.forEach((folder: string) => {
                        candidates.push(folder);
                    })
                })
            }
            
            // Browse direct subfolder children of the rootPath
            utilm.readDirectory(rootPath, false, true, utilm.SearchOption.TopDirectoryOnly)
            .then((subFolders: string[]) => {
                if (subFolders && (subFolders.length > 1)) {
                    // The first element in the collection returned by the method is the rootPath, 
                    // which we've already tested. Ignore it.
                    subFolders.shift();
                    
                    // Merge working directory paths found in subfolders into common candidates collection.
                    subFolders.forEach((subFolder: string) => {
                        addRange(this._getSvnWorkingCopyPaths(subFolder));
                    })
                }
            });
            
            return Q(candidates);
        }
    }

    public svnInfo(folder: string): Q.Promise<any> {
        if (!shell.test("-d", folder)) {
            throw new Error("Folder " + folder + " does not exists");
        }
        
        return this._shellExec('info', [folder, "--xml"])
        .then((ret) => {
            if (!this._success(ret)) {
                return null; 
            }

            if (ret.output) {
                return xmlrReader.read(ret.output, (err, res) => {
                    if (err) {
                        return null;
                    }
                    else {
                        return res.info;
                    }
                });
            }
            else {
                return null;
            }
        });
        
    }

    public update(svnModule: SvnMappingDetails): Q.Promise<number> {
        return this._exec('update', [svnModule.localPath, 
                                     '--revision:' + svnModule.revision, 
                                     '--depth:' + this._toSvnDepth(svnModule.depth), 
                                     '--ignore-externals:' + svnModule.ignoreExternals, 
                                     '--non-interactive']);
    }

    public switch(svnModule: SvnMappingDetails): Q.Promise<number> {
        return this._exec('switch', [svnModule.serverPath,
                                     svnModule.localPath, 
                                     '--revision:' + svnModule.revision, 
                                     '--depth:' + this._toSvnDepth(svnModule.depth), 
                                     '--ignore-externals:' + svnModule.ignoreExternals, 
                                     '--non-interactive']);
    }

    public checkout(svnModule: SvnMappingDetails): Q.Promise<number> {
        return this._exec('checkout', [svnModule.serverPath,
                                       svnModule.localPath, 
                                       '--revision:' + svnModule.revision, 
                                       '--depth:' + this._toSvnDepth(svnModule.depth), 
                                       '--ignore-externals:' + svnModule.ignoreExternals, 
                                       '--non-interactive']);
    }

    public getLatestRevision(sourceBranch: string, sourceRevision: string): Q.Promise<string> {
        
        return this._shellExec('info', [this.endpoint.url, 
                                            "--depth:Empty", 
                                            "--revision:" + sourceRevision, 
                                            "--xml"])
        .then((ret) => {
            if (!this._success(ret)) {
                return sourceRevision; 
            }

            if (ret.output) {
                return xmlrReader.read(ret.output, (err, res) => {
                    if (err) {
                        return sourceRevision;
                    }
                    else {
                        return res.info.entry.revision;
                    }
                });
            }
            else {
                return sourceRevision;
            }
        });
        
    }
    
    public buildSvnUrl(sourceBranch: string, serverPath?: string): string {
        var url: string = this.endpoint.url.replace('\\', '/');
        
        if ((url == null) || (url.length == 0)) {
            throw new Error("Connection endpoint URL cannot be empty.")
        }
        
        url = this.appendPath(url, sourceBranch);
        url = this.appendPath(url, serverPath);
        
        return url;
    }
    
    public appendPath(base: string, path: string): string {
        var url = base.replace('\\', '/');

        if (path && (path.length > 0)) {
            if (url.match(/.*\/$/).length == 0) {
                url = url + '/';
            }
            url = url + path;
        }
        
        return url;
    }

    private _getQuotedArgsWithDefaults(args: string[]): string[] {
        // default connection related args
        var usernameArg = '--username ' + this.endpoint.username;
        var passwordArg = '--password ' + this.endpoint.password;

        var quotedArg = function(arg) {
            var quote = '"';
            if (arg.indexOf('"') > -1) {
                quote = '\'';
            }
            return quote + arg + quote;
        }

        return args.concat([usernameArg, passwordArg, "--non-interactive", "--trust-server-cert"]).map((a) => quotedArg(a));
    }

    private _scrubCredential(msg: string): string {
        if (msg && typeof msg.replace === 'function' 
                    && this.endpoint.password) {
            return msg.replace(this.endpoint.password, "******************");
        }

        return msg;
    }

    private _exec(cmd: string, args: string[], options?: ISvnExecOptions): Q.Promise<number> {
        if (this.svnPath === null) {
            return this._getSvnNotInstalled();
        }

        var svn = new tl.ToolRunner(this.svnPath);
        svn.silent = true;

        svn.on('debug', (message) => {
            this.emit('stdout', '[debug]' + this._scrubCredential(message));
        })

        svn.on('stdout', (data) => {
            this.emit('stdout', this._scrubCredential(data));
        })

        svn.on('stderr', (data) => {
            this.emit('stderr', this._scrubCredential(data));
        })

        // cmd
        svn.arg(cmd, true);

        var quotedArgs = this._getQuotedArgsWithDefaults(args);
        // args
        if (quotedArgs.map((arg: string) => {
            svn.arg(arg, true); // raw arg
        }));

        options = options || <ISvnExecOptions>{};
        var ops: any = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: true,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr,
            failOnStdErr: options.failOnStdErr || false,
            ignoreReturnCode: options.ignoreReturnCode || false
        };

        return svn.exec(ops);
    }

    private _shellExec(cmd, args: string[]): Q.Promise<any> {
        if (this.svnPath === null) {
            return this._getSvnNotInstalled();
        }

        var cmdline = 'svn ' + cmd + ' ' + this._getQuotedArgsWithDefaults(args).join(' ');
        return utilm.exec(cmdline);
    }

    private _getSvnNotInstalled(): Q.Promise<number>{
        var defer = Q.defer<number>();

        defer.reject(new Error("'svn' was not found. Please install the Subversion command-line client and add 'svn' to the path."));

        return defer.promise;
    }

    private _getFolderDoesNotExist(folder: string): Q.Promise<number>{
        var defer = Q.defer<number>();

        defer.reject(new Error("Folder " + folder + " does not exists"));

        return defer.promise;
    }
    
    private _success(ret): boolean {
        return ret && ret.code  === 0;
    }
    
    private _toSvnDepth(depth): string {
        return depth == "0" ? 'Empty' :
               depth == "1" ? 'Files' :
               depth == "2" ? 'Children' :
               depth == "3" ? 'Infinity' :
               depth; 
    }
}
