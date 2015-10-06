import Q = require('q');
import scmprovider = require('./lib/scmprovider');
import agent = require('vso-node-api/interfaces/TaskAgentInterfaces');
import sw = require('./lib/svnwrapper');
import cm = require('../common');
import utilm = require('../utilities');

var shell = require('shelljs');
var path = require('path');
var tl = require('vso-task-lib');

export function getProvider(ctx: cm.IExecutionContext, targetPath: string): cm.IScmProvider {
    return new SvnScmProvider(ctx, targetPath);
}

export class SvnScmProvider extends scmprovider.ScmProvider {
    constructor(ctx: cm.IExecutionContext, targetPath: string) {
        this.svnw = new sw.SvnWrapper();
        this.svnw.on('stdout', (data) => {
            ctx.info(data.toString());
        });

        this.svnw.on('stderr', (data) => {
            ctx.info(data.toString());
        });

        super(ctx, targetPath);
    }

    public svnw: sw.SvnWrapper;
    public username: string;
    public password: string;
    public realmName: string;
    public url: string;
    public endpoint: agent.ServiceEndpoint;
    public defaultRevision: string;
    public defaultBranch: string;

    public initialize(endpoint: agent.ServiceEndpoint) {
        this.endpoint = endpoint;

        if (!endpoint) {
            throw (new Error('endpoint null initializing svn scm provider'));
        }

        if (endpoint.authorization && endpoint.authorization['scheme']) {
            var scheme = endpoint.authorization['scheme'];
            this.ctx.info('Using auth scheme: ' + scheme);

            switch (scheme) {
                case 'UsernamePassword':
                    this.username = process.env['VSO_SVN_USERNAME'] || this.getAuthParameter(endpoint, 'Username') || 'not supplied';
                    this.password = process.env['VSO_SVN_PASSWORD'] || this.getAuthParameter(endpoint, 'Password') || 'not supplied';
                    this.realmName = process.env['VSO_SVN_REALMNAME'] || this.getAuthParameter(endpoint, 'RealmName') || 'not supplied';
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

        var oldMappings: Q.Promise<cm.IStringDictionary> = this.svnw.getOldMappings(this.targetPath);
        var newMappings: sw.ISvnMappingDictionary = this._buildNewMappings(this.endpoint);

        return this._cleanupSvnWorkspace(oldMappings, newMappings)
        .then((ret:number) => {
            if (ret != 0) {
                throw new Error("Failed to cleanup the subversion working directory"); 
            }
        })
        .then(() => {
            return this.svnw.getLatestRevision(this.defaultBranch, this.defaultRevision);
        })
        .then((latestRevision: string) => {
            var promiseChain = Q(0);

            oldMappings.then((currentMappings: cm.IStringDictionary) => {
                for (var localPath in newMappings) {
                    var mappingDetails: sw.SvnMappingDetails = newMappings[localPath];
                    var serverPath: string = mappingDetails.serverPath;
                    var effectiveRevision: string = mappingDetails.revision.toUpperCase() === 'HEAD' ? latestRevision : mappingDetails.revision;
                    mappingDetails.revision = effectiveRevision;
                    
                    if (!shell.test('-d', this.svnw.appendPath(localPath, '.svn'))) {
                        promiseChain = promiseChain.then(() => {
                            this.ctx.info("Checking out with depth: " + mappingDetails.depth 
                                        + ", revision: " + mappingDetails.revision 
                                        + ", ignore externals: " + mappingDetails.ignoreExternals);
                            return this.svnw.checkout(mappingDetails)
                        });
                    }
                    else if (currentMappings[localPath] && (currentMappings[localPath] === serverPath)) {
                        promiseChain = promiseChain.then(() => {
                            this.ctx.info("Updating with depth: " + mappingDetails.depth 
                                        + ", revision: " + mappingDetails.revision 
                                        + ", ignore externals: " + mappingDetails.ignoreExternals);
                            return this.svnw.update(mappingDetails)
                        });
                    }
                    else {
                        promiseChain = promiseChain.then(() => {
                            this.ctx.info("Switching to ^" + serverPath
                                        + " with depth: " + mappingDetails.depth 
                                        + ", revision: " + mappingDetails.revision 
                                        + ", ignore externals: " + mappingDetails.ignoreExternals);
                            return this.svnw.switch(mappingDetails)
                        });
                    }
                }
            });
            
            return promiseChain;
        })
    }

    // Remove the target folder
    public clean(): Q.Promise<number> {
        if (this.enlistmentExists()) {
            return utilm.exec('rm -fr ' + this.targetPath)
            .then((ret) => { return ret.code});
        } else {
            this.ctx.debug('Skip delete nonexistent local source directory');
            return Q(0); 
        }
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
                }
                else {
                    if ((localPath == null) || (localPath.length == 0)) {
                        localPath = this._normalizeRelativePath(serverPath);
                    }
                    
                    if ((distinctLocalPaths[localPath] == null) && (distinctServerPaths[serverPath] == null)) {
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
    
    private _buildNewMappings(endpoint: agent.ServiceEndpoint): sw.ISvnMappingDictionary {
        var svnMappings: sw.ISvnMappingDictionary = {};

        if (endpoint && endpoint.data && endpoint.data['svnWorkspaceMapping']) {
            var svnWorkspace: sw.SvnWorkspace = JSON.parse(endpoint.data['svnWorkspaceMapping']);
            
            if (svnWorkspace && svnWorkspace.mappings) {
                var distinctMappings = this._normalizeMappings(svnWorkspace.mappings);

                if (distinctMappings) {
                    for (var key in distinctMappings) {
                        var value: sw.SvnMappingDetails = distinctMappings[key];
                        
                        var serverPath: string = key;
                        var absoluteLocalPath: string = this.svnw.appendPath(this.targetPath, value.localPath);
                        var url: string = this.svnw.buildSvnUrl(this.defaultBranch, serverPath);
                        
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
            depth: 'Infinity',
            ignoreExternals: true
        };
        
        return svnMappings;
    }
    
    private _cleanupSvnWorkspace(oldMappings: Q.Promise<cm.IStringDictionary>, newMappings: sw.ISvnMappingDictionary): Q.Promise<number> {
        var retSummary: number = 0;
        oldMappings.then((currentMappings: cm.IStringDictionary) => {
            for(var key in currentMappings) {
                if (newMappings[key] == null) {
                    utilm.exec('rm -fr ' + this.targetPath)
                    .then((ret) => {
                        if (ret.code > retSummary) {
                            retSummary = ret.code;
                        }
                    });
                }
            }
        });
        return Q(retSummary);
    }
}
