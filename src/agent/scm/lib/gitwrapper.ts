/// <reference path="../../definitions/node.d.ts"/>

// TODO: convert vso-task-lib to TS and generate .d.ts file
var tl = require('vso-task-lib');
import events = require('events');
import Q = require('q');
var path = require('path');

export var envGitUsername = 'GIT_USERNAME';
export var envGitPassword = 'GIT_PASSWORD';

export interface IGitExecOptions {
    useGitExe: boolean;
    creds: boolean;
    cwd: string;
    env: { [key: string]: string };
    silent: boolean;
    outStream: NodeJS.WritableStream;
    errStream: NodeJS.WritableStream;
};

// TODO: support isolated local copy of git
var _gitLocalPath = path.join(__dirname, process.platform, 'libgit_host');

// TODO: move into vso-task-lib??
export class GitWrapper extends events.EventEmitter {
    constructor() {
        this.gitInstalled = tl.which('git', false) !== null;
        super();
    }

    public username: string;
    public password: string;

    public gitInstalled: boolean;

    public clone(repository: string, progress: boolean, folder: string, options?: IGitExecOptions): Q.Promise<number> {
        options = options || <IGitExecOptions>{};
        options.useGitExe = true;
        options.creds = true;
        var args = ['clone', repository];

        if (progress) {
            args.push('--progress');
        }

        if (folder) {
            args.push(folder);
        }

        return this.exec(args, options);
    }

    public fetch(options?: IGitExecOptions): Q.Promise<number> {
        options = options || <IGitExecOptions>{};
        options.useGitExe = true;
        options.creds = true;        
        return this.exec(['fetch'], options);
    }

    public checkout(ref: string, options?: IGitExecOptions): Q.Promise<number> {
        options = options || <IGitExecOptions>{};
        options.useGitExe = true;
        options.creds = true;
        return this.exec(['checkout', ref], options);
    }

    public clean(args: string[], options?: IGitExecOptions): Q.Promise<number> {
        options = options || <IGitExecOptions>{};
        options.useGitExe = true;
        return this.exec(args, options);
    }

    public submodule(args: string[], options?: IGitExecOptions): Q.Promise<number> {
        options = options || <IGitExecOptions>{};
        options.useGitExe = true;
        return this.exec(['submodule'].concat(args), options);
    }

    public exec(args: string[], options?: IGitExecOptions): Q.Promise<number> {
        options = options || <IGitExecOptions>{};
        var defer = Q.defer<number>();

        var gitPath = options.useGitExe || process.env['AGENT_USEGITEXE'] ? tl.which('git', false) : _gitLocalPath;
        if (!gitPath) {
            defer.reject(new Error('git not found in the path'));
            return;
        }

        var git = new tl.ToolRunner(gitPath);
        git.on('stdout', (data) => {
            this.emit('stdout', data);
        })

        git.on('stderr', (data) => {
            this.emit('stderr', data);
        })
        
        // TODO: if HTTP_PROXY is set (debugging) we can also supply http.proxy config
        // TODO: handle and test with spaces in the path

        if (options.creds) {
            // protect against private repo where no creds are supplied (external) - we don't want a prompt
            process.env[envGitUsername] = this.username || 'none';
            process.env[envGitPassword] = this.password || '';
            var credHelper = path.join(__dirname, 'credhelper.js');
            git.arg('-c');
            
            // TODO: test quoting and spaces
            git.arg('credential.helper=' + credHelper, true); // raw arg
        }

        if (args.map((arg: string) => {
            git.arg(arg, true); // raw arg
        }));

        options = options || <IGitExecOptions>{};
        var ops: any = {
            cwd: options.cwd || process.cwd(),
            env: options.env || process.env,
            silent: true,
            outStream: options.outStream || process.stdout,
            errStream: options.errStream || process.stderr,
            failOnStdErr: false,
            ignoreReturnCode: false
        };

        return git.exec(ops)
        .fin(() => {
            process.env[envGitUsername] = null;
            process.env[envGitPassword] = null;
        }); 
    }
}
