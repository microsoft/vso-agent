import Q = require('q');
import scmprovider = require('./lib/scmprovider');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import sw = require('./lib/svnwrapper');
import cm = require('../common');
import utilm = require('../utilities');

var shell = require('shelljs');
var path = require('path');
var tl = require('vso-task-lib');

export function getProvider(ctx: cm.IExecutionContext, endpoint: agentifm.ServiceEndpoint): cm.IScmProvider {
    return new SvnScmProvider(ctx, endpoint);
}

export class SvnScmProvider extends scmprovider.ScmProvider {
    constructor(ctx: cm.IExecutionContext, endpoint: agentifm.ServiceEndpoint) {
        this.svnw = new sw.SvnWrapper(ctx);
        this.svnw.on('stdout', (data) => {
            ctx.info(data.toString());
        });

        this.svnw.on('stderr', (data) => {
            ctx.info(data.toString());
        });

        super(ctx, endpoint);
    }

    public svnw: sw.SvnWrapper;
    public username: string;
    public password: string;
    public realmName: string;
    public url: string;
    public endpoint: agentifm.ServiceEndpoint;
    public defaultRevision: string;
    public defaultBranch: string;

    public setAuthorization(authorization: agentifm.EndpointAuthorization) {

        if (authorization && authorization['scheme']) {
            var scheme = authorization['scheme'];
            this.ctx.info('Using auth scheme: ' + scheme);


            switch (scheme) {
                case 'UsernamePassword':
                    this.username = process.env['VSO_SVN_USERNAME'] || this.getAuthParameter(authorization, 'Username') || '';
                    this.password = process.env['VSO_SVN_PASSWORD'] || this.getAuthParameter(authorization, 'Password') || '';
                    this.realmName = process.env['VSO_SVN_REALMNAME'] || this.getAuthParameter(authorization, 'RealmName') || '';
                    break;

                default:
                    this.ctx.warning('invalid auth scheme: ' + scheme);
            }
        }

        this.svnw.setSvnConnectionEndpoint(<sw.ISvnConnectionEndpoint> {
            username: this.username,
            password: this.password,
            realmName: this.realmName,
            url: this.endpoint.url
        });
    }

    public getCode(): Q.Promise<number> {
        this._ensurePathExist(this.targetPath);

        var srcVersion = this.ctx.jobInfo.jobMessage.environment.variables['build.sourceVersion'];
        var srcBranch = this.ctx.jobInfo.jobMessage.environment.variables['build.sourceBranch'];
        this.defaultRevision = this._expandEnvironmentVariables(srcVersion);
        this.defaultBranch = this._expandEnvironmentVariables(srcBranch);
        this.ctx.info('Revision: ' + this.defaultRevision);
        this.ctx.info('Branch: ' + this.defaultBranch);

        var newMappings: sw.ISvnMappingDictionary = this._buildNewMappings(this.endpoint);
        var oldMappings: cm.IStringDictionary = {};

        return this.svnw.getOldMappings(this.targetPath)
        .then((mappings) => {
            oldMappings = mappings;
            this.ctx.verbose("OldMappings: " + JSON.stringify(oldMappings));
            this.ctx.verbose("NewMappings: " + JSON.stringify(newMappings));
            this._cleanupSvnWorkspace(mappings, newMappings)
        })
        .then(() => {
            return this.svnw.getLatestRevision(this.defaultBranch, this.defaultRevision);
        })
        .then((latestRevision: string) => {
            var deferred = Q.defer<number>();
            
            var promiseChain = Q(0);
            
            for (var localPath in newMappings) {
                var mapping: sw.SvnMappingDetails = newMappings[localPath];
                var serverPath: string = mapping.serverPath;
                var effectiveRevision: string = mapping.revision.toUpperCase() === 'HEAD' ? latestRevision : mapping.revision;
                var effectiveMapping: sw.SvnMappingDetails = {
                        localPath: mapping.localPath,
                        serverPath: mapping.serverPath,
                        revision: effectiveRevision,
                        depth: mapping.depth,
                        ignoreExternals: mapping.ignoreExternals};

                this.ctx.verbose("effectiveMapping for " + effectiveMapping.localPath);
                this.ctx.verbose("         serverPath: " + effectiveMapping.serverPath);
                this.ctx.verbose("         revision: " + effectiveMapping.revision);
                this.ctx.verbose("         depth: " + effectiveMapping.depth);
                this.ctx.verbose("         ignoreExternals: " + effectiveMapping.ignoreExternals);
                
                if (!shell.test('-d', this.svnw.appendPath(localPath, sw.administrativeDirectoryName))) {
                    promiseChain = this._addCheckoutPromise(promiseChain, effectiveMapping);
                }
                else if (oldMappings[localPath] && (oldMappings[localPath] === serverPath)) {
                    promiseChain = this._addUpdatePromise(promiseChain, effectiveMapping);
                }
                else {
                    promiseChain = this._addSwitchPromise(promiseChain, effectiveMapping);
                }
            };
        
            promiseChain.then(
                (ret) => {
                    deferred.resolve(ret);
                },
                (err) => {
                    deferred.reject(err);
                }
            );
            
            return deferred.promise;
        });
    }

    // Remove the target folder
    public clean(): Q.Promise<number> {
        this.ctx.info("Remove the target folder");
        if (this.enlistmentExists()) {
            return utilm.exec('rm -fr ' + this.targetPath)
            .then((ret) => { return Q(ret.code)});
        } else {
            this.ctx.debug('Skip deleting nonexisting local source directory ' + this.targetPath);
            return Q(0); 
        }
    }

    private _addCheckoutPromise(promiseChain: Q.Promise<number>, effectiveMapping: sw.SvnMappingDetails): Q.Promise<number> {
        var svnModuleMapping: sw.SvnMappingDetails = effectiveMapping;
        var oldChain: Q.Promise<number> = promiseChain;
        return oldChain.then((ret) => {
            return this.svnw.checkout(svnModuleMapping);
        });
    }

    private _addUpdatePromise(promiseChain: Q.Promise<number>, effectiveMapping: sw.SvnMappingDetails): Q.Promise<number> {
        var svnModuleMapping: sw.SvnMappingDetails = effectiveMapping;
        var oldChain: Q.Promise<number> = promiseChain;
        return oldChain.then((ret) => {
            return this.svnw.update(svnModuleMapping);
        });
    }

    private _addSwitchPromise(promiseChain: Q.Promise<number>, effectiveMapping: sw.SvnMappingDetails): Q.Promise<number> {
        var svnModuleMapping: sw.SvnMappingDetails = effectiveMapping;
        var oldChain: Q.Promise<number> = promiseChain;
        return oldChain.then((ret) => {
            return this.svnw.switch(svnModuleMapping);
        });
    }

    private _ensurePathExist(path: string) {
        if (!shell.test('-d', path)) {
            this.ctx.debug("mkdir -p " + path);
            shell.mkdir("-p", path); 
        }
    }
    
    private _normalizeRelativePath(path: string) {
        var normalizedPath = path || '';

        if (normalizedPath.indexOf(':') + normalizedPath.indexOf('..') > -2) {
            throw new Error('Incorrect relative path ' + path + ' specified.');
        }
        
        normalizedPath = normalizedPath.trim().replace('\\', '/');                        // convert path separators
        normalizedPath = normalizedPath.replace(/^(\/+).*(\/)+$/, (s) => { return ''; }); // remove leading and trailing path separators
        
        return normalizedPath;
    }
    
    private _normalizeBranch(branch: string) {
        var normalizedBranch = this._normalizeRelativePath(branch);
        return (branch || '').length == 0 ? 'trunk' : branch;
    }

    private _normalizeMappings(allMappings: sw.SvnMappingDetails[]): sw.ISvnMappingDictionary {
        var distinctMappings: sw.ISvnMappingDictionary = <sw.ISvnMappingDictionary>{};
        var distinctLocalPaths: cm.IStringDictionary = <cm.IStringDictionary>{};
        var distinctServerPaths: cm.IStringDictionary = <cm.IStringDictionary>{};
        var fullMapping = false;
        
        allMappings.forEach((map: sw.SvnMappingDetails) => {
            var localPath = this._normalizeRelativePath(this._expandEnvironmentVariables(map.localPath));
            var serverPath = this._normalizeRelativePath(this._expandEnvironmentVariables(map.serverPath));
            
            if (!fullMapping) {
                if ((serverPath == null) || (serverPath.length == 0)) {
                    this.ctx.verbose("The empty relative server path is mapped to '" + localPath + "'.")
                    this.ctx.verbose("The entire mapping set is ignored. Proceeding with the full branch mapping.")
                    
                    fullMapping = true;
                    distinctMappings = null;
                    distinctMappings = <sw.ISvnMappingDictionary>{};
                    distinctMappings[localPath] = map;
                }
                else {
                    if (!(localPath && localPath.length > 0)) {
                        localPath = serverPath;
                    }
                    
                    if ((distinctLocalPaths[localPath] == null) && (distinctServerPaths[serverPath] == null)) {
                        map.localPath = localPath;
                        map.serverPath = serverPath;
                        
                        distinctMappings[localPath] = map;
                        distinctLocalPaths[localPath] = localPath;
                        distinctServerPaths[serverPath] = serverPath;                        
                    }
                    
                }
            }
        });
        
        return distinctMappings;
    }
    
    private _expandEnvironmentVariables(s: string): string {
        var environment = this.ctx.jobInfo.jobMessage.environment;
        return (s || '').replaceVars(environment.variables);
    }
    
    private _buildNewMappings(endpoint: agentifm.ServiceEndpoint): sw.ISvnMappingDictionary {
        var svnMappings: sw.ISvnMappingDictionary = {};

        if (endpoint && endpoint.data && endpoint.data['svnWorkspaceMapping']) {
            var svnWorkspace: sw.SvnWorkspace = JSON.parse(endpoint.data['svnWorkspaceMapping']);
            
            if (svnWorkspace && svnWorkspace.mappings && svnWorkspace.mappings.length > 0) {
                var distinctMappings = this._normalizeMappings(svnWorkspace.mappings);

                if (distinctMappings) {
                    for (var key in distinctMappings) {
                        var value: sw.SvnMappingDetails = distinctMappings[key];
                        
                        var absoluteLocalPath: string = this.svnw.appendPath(this.targetPath, value.localPath);
                        var url: string = this.svnw.buildSvnUrl(this.defaultBranch, value.serverPath);
                        
                        svnMappings[absoluteLocalPath] = {
                            serverPath: url,
                            localPath: absoluteLocalPath,
                            revision: value.revision,
                            depth: value.depth,
                            ignoreExternals: value.ignoreExternals
                        };
                    }
                    
                    return svnMappings;
                }
            }
        }

        svnMappings[this.targetPath] = {
            serverPath: this.svnw.buildSvnUrl(this.defaultBranch),
            localPath: this.targetPath,
            revision: 'HEAD',
            depth: 'infinity',
            ignoreExternals: true
        };
        
        return svnMappings;
    }
    
    private _cleanupSvnWorkspace(oldMappings: cm.IStringDictionary, newMappings: sw.ISvnMappingDictionary): Q.Promise<number> {
        var promiseChain: Q.Promise<number>  = Q(0);
        
        this.ctx.verbose("_cleanupSvnWorkspace");
        
        for(var localPath in oldMappings) {
            if (!newMappings[localPath]) {
                this.ctx.verbose("Removing old mapping folder " + localPath);
                shell.rm('-rf', localPath);
            }
        };
        
        return promiseChain;
    }
}
