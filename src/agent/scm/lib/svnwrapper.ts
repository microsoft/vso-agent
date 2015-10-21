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
var xmlReader = require('xmlreader');

import fs = require('fs');

export var administrativeDirectoryName = ".svn";

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
    constructor(ctx: cm.IExecutionContext) {
        this.svnPath = shell.which('svn', false);
        this.endpoint = <ISvnConnectionEndpoint>{};
        this.ctx = ctx;
        super();
    }

    public svnPath: string;
    public endpoint: ISvnConnectionEndpoint;
    public ctx: cm.IExecutionContext;

    public setSvnConnectionEndpoint(endpoint: ISvnConnectionEndpoint) {
        if (endpoint) {
            this.endpoint = endpoint;
        }
    }

    public getOldMappings(rootPath: string): Q.Promise<cm.IStringDictionary> {
        if (shell.test("-f", rootPath)) {
            throw new Error("The file " + rootPath + " already exists.");
        }

        if (shell.test("-d", rootPath)) {
            
            return this._getSvnWorkingCopyPaths(rootPath)
            .then((workingDirectoryPaths: string[]) => {
                var mappingsPromise: Q.Promise<cm.IStringDictionary> = Q(<cm.IStringDictionary>{});

                if (workingDirectoryPaths) {
                    var mappings: cm.IStringDictionary = <cm.IStringDictionary>{}; 
        
                    workingDirectoryPaths.forEach((workingDirectoryPath: string) => {
                        mappingsPromise = mappingsPromise
                        .then((v) => {
                            return this._getTargetUrl(workingDirectoryPath)
                        })
                        .then((url) => {
                            if (url) {
                                mappings[workingDirectoryPath] = url;
                            }
                            return Q(mappings);
                        });
                    });
                    
                }
                
                return mappingsPromise;
            });
        }
        else {
            return Q(<cm.IStringDictionary>{});
        }
    }
    
    private _getSvnWorkingCopyPaths(rootPath: string): Q.Promise<string[]> {
        var candidates: string[] = []; 
        var deferred: Q.Deferred<string[]> = Q.defer<string[]>();
        
        if (shell.test("-d", path.join(rootPath, administrativeDirectoryName))) {
            // The rootPath contains .svn subfolder and we treat it as
            // a working copy candidate.  
            deferred.resolve([rootPath]);
        }
        else {
            // Browse direct subfolder children of the rootPath
            utilm.readDirectory(rootPath, false, true, utilm.SearchOption.TopDirectoryOnly)
            .then((subFolders: string[]) => {

                // The first element in the collection returned by the method is the rootPath, 
                // which we've already tested. Ignore it.
                subFolders.shift();

                var count = subFolders.length;
                if (count > 0) {
                    subFolders.forEach((subFolder) => {
                        if (shell.test("-d", path.join(subFolder, administrativeDirectoryName))) {
                            // The subfolder contains .svn directory and we treat it as
                            // a working copy candidate.
                            candidates.push(subFolder); 
                            if (--count == 0) {
                                deferred.resolve(candidates);
                            } 
                        }
                        else {
                            // Merge working directory paths found in the subfolder into the common candidates collection.
                            this._getSvnWorkingCopyPaths(subFolder)
                            .then((moreCandidates) => {
                                candidates = candidates.concat(moreCandidates);
                                if (--count == 0) {
                                    deferred.resolve(candidates);
                                } 
                            })
                        }
                        
                    });
                }
                else {
                    deferred.resolve(candidates);
                }
            });
        }
        
        return deferred.promise;
    }

    private _getTargetUrl(folder: string): Q.Promise<string> {
        if (!shell.test("-d", folder)) {
            throw new Error("Folder " + folder + " does not exists");
        }
        
        var deferred = Q.defer<string>();
        
        this._shellExec('info', [folder, "--depth", "empty", "--xml"])
        .then((ret) => {
            if (!this.isSuccess(ret)) {
                deferred.resolve(null);
            }
            else if (ret.output) {
                xmlReader.read(ret.output, (err, res) => {
                    if (err) {
                        deferred.reject(err);
                    }
                    else {
                        try {
                            return deferred.resolve(res.info.entry.url.text());
                        }
                        catch (e) {
                            deferred.reject(e);
                        }
                    }
                });
            }
            else {
                deferred.resolve(null);
            }
        });
        
        return deferred.promise;
    }

    public getLatestRevision(sourceBranch: string, sourceRevision: string): Q.Promise<string> {
        return this._shellExec('info', [this.buildSvnUrl(sourceBranch), 
                                        "--depth", "empty", 
                                        "--revision", sourceRevision, 
                                        "--xml"])
        .then((ret) => {
            var defer = Q.defer<any>(); 
            
            if (!this.isSuccess(ret)) {
                defer.reject(ret.output); 
            }
            else {
                try {
                    xmlReader.read(ret.output, (err, res) => {
                        if (err) {
                            defer.reject(err);
                        }
                        else {
                            defer.resolve(res);
                        }
                    });
                }
                catch (e) {
                    defer.reject(e);
                }
            }
            return defer.promise;
        })
        .then(
            (res) => {
                var rev: string = res.info.entry.commit.attributes()["revision"];
                this.ctx.verbose("Latest revision: " + rev);
                return rev;
            },
            (err) => {
                this.ctx.verbose("Subversion call filed: " + err);
                this.ctx.verbose("Using the original revision: " + sourceRevision);
                return sourceRevision;
            }
        );
    }
    
    public update(svnModule: SvnMappingDetails): Q.Promise<number> {
        this.ctx.info("Updating " + svnModule.localPath
                    + " with depth: " + svnModule.depth 
                    + ", revision: " + svnModule.revision 
                    + ", ignore externals: " + svnModule.ignoreExternals);
        var args: string[] = [svnModule.localPath, 
                             '--revision', svnModule.revision, 
                             '--depth', this._toSvnDepth(svnModule.depth)];
        if (svnModule.ignoreExternals) {
            args.push('--ignore-externals');
        }
        
        return this._exec('update', args);
    }

    public switch(svnModule: SvnMappingDetails): Q.Promise<number> {
        this.ctx.info("Switching " + svnModule.localPath
                    + " to ^" + svnModule.serverPath
                    + " with depth: " + svnModule.depth 
                    + ", revision: " + svnModule.revision 
                    + ", ignore externals: " + svnModule.ignoreExternals);
        var args: string[] = [svnModule.serverPath,
                              svnModule.localPath, 
                             '--revision', svnModule.revision, 
                             '--depth', this._toSvnDepth(svnModule.depth)];
        if (svnModule.ignoreExternals) {
            args.push('--ignore-externals');
        }
        
        return this._exec('switch', args);
    }

    public checkout(svnModule: SvnMappingDetails): Q.Promise<number> {
        this.ctx.info("Checking out " + svnModule.localPath
                    + " with depth: " + svnModule.depth 
                    + ", revision: " + svnModule.revision 
                    + ", ignore externals: " + svnModule.ignoreExternals);

        var args: string[] = [svnModule.serverPath,
                              svnModule.localPath, 
                             '--revision', svnModule.revision, 
                             '--depth', this._toSvnDepth(svnModule.depth)];
        if (svnModule.ignoreExternals) {
            args.push('--ignore-externals');
        }
        
        return this._exec('checkout', args);
    }

    public buildSvnUrl(sourceBranch: string, serverPath?: string): string {
        var url: string = this.endpoint.url;
        
        if ((url == null) || (url.length == 0)) {
            throw new Error("Connection endpoint URL cannot be empty.")
        }
        
        url = this.appendPath(url.replace('\\', '/'), sourceBranch);
        if (serverPath) {
            url = this.appendPath(url, serverPath);
        }

        return url;
    }
    
    public appendPath(base: string, path: string): string {
        var url = base.replace('\\', '/');

        if (path && (path.length > 0)) {
            if (!url.endsWith('/')) {
                url = url + '/';
            }
            url = url + path;
        }
        
        return url;
    }

    private _getQuotedArgsWithDefaults(args: string[]): string[] {
        // default connection related args
        var usernameArg = '--username';
        var passwordArg = '--password';
        
        var defaults: string[] = [];
        
        if (this.endpoint.username && this.endpoint.username.length > 0) {
            this.ctx.verbose("username=" + this.endpoint.username);
            defaults.push(usernameArg, this.endpoint.username);
        }
        if (this.endpoint.password && this.endpoint.password.length > 0) {
            this.ctx.verbose("password=" + this.endpoint.password);
            defaults.push(passwordArg, this.endpoint.password);
        }

        var quotedArg = function(arg) {
            var quote = '"';
            if (arg.indexOf('"') > -1) {
                quote = '\'';
            }
            return quote + arg + quote;
        }

        return args.concat(defaults).map((a) => quotedArg(a));
    }

    private _scrubCredential(msg: string): string {
        if (msg && typeof msg.replace === 'function' 
                    && this.endpoint.password) {
            return msg.replace(this.endpoint.password, cm.MASK_REPLACEMENT);
        }

        return msg;
    }

    private _exec(cmd: string, args: string[], options?: ISvnExecOptions): Q.Promise<number> {
        if (this.svnPath === null) {
            return this._getSvnNotInstalled();
        }

        var svn = new tl.ToolRunner(this.svnPath);
        svn.silent = !this.isDebugMode();

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
            silent: !this.isDebugMode(),
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

        var cmdline = this.svnPath + ' ' + cmd + ' ' + this._getQuotedArgsWithDefaults(args).join(' ');
        
        return utilm.exec(cmdline)
        .then ((v) => {
            this.ctx.verbose(this._scrubCredential(cmdline));
            this.ctx.verbose(JSON.stringify(v));
            return v;
        });
    }

    private _getSvnNotInstalled(): Q.Promise<number>{
        return Q.reject<number>(new Error("'svn' was not found. Please install the Subversion command-line client and add 'svn' to the path."));
    }

    private _toSvnDepth(depth): string {
        return depth == "0" ? 'empty' :
               depth == "1" ? 'files' :
               depth == "2" ? 'children' :
               depth == "3" ? 'infinity' :
               depth || 'infinity'; 
    }
    
    public isSuccess(ret): boolean {
        return ret && ret.code  === 0;
    }
    
    public isDebugMode(): boolean {
        var environment = this.ctx.jobInfo.jobMessage.environment;
        var debugMode: string = environment.variables["system.debug"] || 'false';
        return debugMode === 'true';
    }
}