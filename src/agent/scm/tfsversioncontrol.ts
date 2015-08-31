import Q = require('q');
import scmm = require('./lib/scmprovider');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import tfvcwm = require('./lib/tfvcwrapper');
import ctxm = require('../context');
import utilm = require('../utilities');
import cm = require('../common');

var shell = require('shelljs');
var path = require('path');
var tl = require('vso-task-lib');


export function getProvider(ctx: ctxm.JobContext, targetPath: string): cm.IScmProvider {
    return new TfsvcScmProvider(ctx, targetPath);
}

export class TfsvcScmProvider extends scmm.ScmProvider {
    constructor(ctx: ctxm.JobContext, targetPath: string) {
        this.tfvcw = new tfvcwm.TfvcWrapper();
        this.tfvcw.on('stdout', (data) => {
            ctx.info(data.toString());
        });

        this.tfvcw.on('stderr', (data) => {
            ctx.info(data.toString());
        });

        super(ctx, targetPath);
    }

    public tfvcw: tfvcwm.TfvcWrapper;
    public username: string;
    public password: string;
    public endpoint: agentifm.ServiceEndpoint;
    public workspaceName: string;
    public version: string;
    public shelveset: string;

    public initialize(endpoint: agentifm.ServiceEndpoint) {
        this.endpoint = endpoint;

        if (!endpoint) {
            throw (new Error('endpoint null initializing tfvc scm provider'));
        }

        if (endpoint.authorization && endpoint.authorization['scheme']) {
            var scheme = endpoint.authorization['scheme'];
            this.ctx.info('Using auth scheme: ' + scheme);

            switch (scheme) {
                case 'OAuth':
                    this.username = process.env['VSO_TFVC_USERNAME'] || 'OAuth';
                    this.password = process.env['VSO_TFVC_PASSWORD'] || this.getAuthParameter(endpoint, 'AccessToken') || 'not supplied';
                    break;

                default:
                    this.ctx.warning('invalid auth scheme: ' + scheme);
            }
        }

        var collectionUri = this.ctx.variables['system.teamFoundationCollectionUri'];
        if (!collectionUri) {
            throw (new Error('collectionUri null initializing tfvc scm provider'));
        }

        this.tfvcw.setTfvcConnOptions(<tfvcwm.ITfvcConnOptions> {
            username: this.username,
            password: this.password,
            collection: collectionUri
        });

        this.workspaceName = this._getWorkspaceName();

        this.version = this.ctx.job.environment.variables['build.sourceVersion'];
        this.shelveset = this.ctx.job.environment.variables['build.sourceTfvcShelveset'];
    }

    public getCode(): Q.Promise<number> {
        var buildDefinitionMappings = this._getTfvcMappings(this.endpoint);

        var byType = function(mappings: tfvcwm.TfvcMapping[], type: string) {
            return mappings.filter((mapping) => {
                return mapping.type === type; 
            });
        }

        var isMappingIdentical = function(buildDefMappings, currMappings: tfvcwm.TfvcMapping[]) {
            if (!buildDefMappings) {
                throw new Error("Could not read mappings from build definition"); 
            }

            if (!currMappings) {
                // this should never happen as we should always get empty arrays
                throw new Error("Could not read workspace mapping from current workspace"); 
            }

            if (buildDefMappings.length !== currMappings.length) {
                return false; 
            }

            // hopefully mappings are short lists so a naive comparison isn't too terriably slow
            var contains = function(m: tfvcwm.TfvcMapping, mArray: tfvcwm.TfvcMapping[]): boolean {
                for(var i = 0; i < mArray.length; i++) {
                    if (m.type === mArray[i].type && m.serverPath === mArray[i].serverPath) {
                        return true; 
                    } 
                }

                return false;
            }

            var extraInBuildDefinition = buildDefMappings.filter((mapping) => {
                return !contains(mapping, currMappings); 
            });

            if (extraInBuildDefinition.length !== 0) {
                return false; 
            }

            var extraInCurrMapping = currMappings.filter((mapping) => {
                return !contains(mapping, buildDefMappings); 
            });

            if (extraInCurrMapping.length !== 0) {
                return false; 
            }

            return true;
        }

        return this.tfvcw.getWorkspace(this.workspaceName)
        .then((workspace: tfvcwm.TfvcWorkspace) => {
            if (workspace) {
                if (isMappingIdentical(buildDefinitionMappings, workspace.mappings)) {
                    //workspace exists and the mappings are identical
                    //just undo pending changes so we can do 'tf get' later
                    var getCodePromiseChain = Q(0);
                    byType(buildDefinitionMappings, "map").forEach((mapping) => {
                        this.ctx.info("cd "+mapping.localPath);
                        this._ensurePathExist(mapping.localPath);
                        shell.cd(mapping.localPath);

                        this.ctx.info("Undo changes for "+mapping.serverPath);
                        getCodePromiseChain = getCodePromiseChain.then(() => {
                            return this.tfvcw.undo();
                        }, () => {
                            //ignore any undo error from previous step (it errors if there is no pending changes)
                            return this.tfvcw.undo();
                        });
                    });

                    return getCodePromiseChain.then(() => {
                        // just pass the workspace down
                        return workspace;
                    }, () => {
                        //ignore any undo error from previous step (it errors if there is no pending changes)
                        return workspace; 
                    });
                } else {
                    //workspace exists and the mappings have been changed, cleanup
                    this.ctx.info("The current workspace mappings are different from mappings on the build definition.");
                    this.ctx.info("Clean up existing workspace and remap.");

                    return this.tfvcw.deleteWorkspace(workspace)
                    .then((code: number) => {
                        if (this.enlistmentExists()) {
                            return utilm.exec('rm -fr ' + this.targetPath)
                            .then((ret) => { return ret.code});
                        } else {
                            this.ctx.debug('Skip delete nonexistent local source directory');
                            return Q(0); 
                        }
                    })
                    .then(() => {
                        //there is no workspace 
                        return null; 
                    });
                }
            } else {
                //there is no workspace 
                return null; 
            }
        })
        .then((workspace: tfvcwm.TfvcWorkspace) => {
            if (workspace) {
                //workspace is identical, just pass it down
                return workspace;
            } else {
                //workspace either doesn't exist, or we deleted it due to mapping changed
                //need to recreate  
                var newWorkspace = <tfvcwm.TfvcWorkspace> {
                    name: this.workspaceName,
                    mappings: []
                };
                this.ctx.info("Creating workspace " + newWorkspace.name);
                return this.tfvcw.newWorkspace(newWorkspace)
                .then((code: number) => {
                    if (code !== 0) {
                        throw new Error("Failed to create workspace: "+newWorkspace.name); 
                    }
                })
                .then(()=> {
                    //get latest workspace
                    return this.tfvcw.getWorkspace(newWorkspace.name);
                });
            }
        })
        .then((workspace: tfvcwm.TfvcWorkspace) => {
            // workspace must eixst now, either identical, or newly created
            if (workspace.mappings.length === 0) {
                //newly created, need to map the mappings
                //map first
                var promiseChain = Q(0);
                byType(buildDefinitionMappings, "map").forEach((mapping) => {
                    promiseChain = promiseChain.then(() => {
                        this.ctx.info("Mapping " + mapping.serverPath);
                        return this.tfvcw.mapFolder(mapping.serverPath, mapping.localPath, workspace);
                    });
                });

                //cloak last 
                byType(buildDefinitionMappings, "cloak").forEach((mapping) => {
                    promiseChain = promiseChain.then(() => {
                        this.ctx.info("Cloaking " + mapping.serverPath);
                        return this.tfvcw.cloakFolder(mapping.serverPath, workspace);
                    });
                });

                return promiseChain;
            } else {
                return Q(0);
            }
        })
        .then(() => {
            // now it's guaranteed build definition mapping and actual workspace mapping are identical
            var getCodePromiseChain = Q(0);

            byType(buildDefinitionMappings, "map").forEach((mapping) => {
                getCodePromiseChain = getCodePromiseChain.then(() => {
                    this.ctx.info("cd "+mapping.localPath);
                    this._ensurePathExist(mapping.localPath);
                    shell.cd(mapping.localPath);

                    this.ctx.info("Getting files for "+mapping.serverPath);
                    return this.tfvcw.get(this.version);
                });
            });

            return getCodePromiseChain;
        })
        .then((code: number) => {
            if (this.shelveset) {
                shell.cd(this.targetPath);
                this.ctx.info("Unshelving "+this.shelveset);
                return this.tfvcw.unshelve(this.shelveset, <tfvcwm.TfvcWorkspace> {
                    name: this.workspaceName
                });
            } else {
                return Q(0);
            }
        });
    }

    // clean a workspace. Delete the workspace and remove the target folder
    public clean(): Q.Promise<number> {
        // clean workspace and delete local folder
        return this.tfvcw.getWorkspace(this.workspaceName)
        .then((workspace: tfvcwm.TfvcWorkspace) => {
            if (workspace) {
                return this.tfvcw.deleteWorkspace(workspace);
            } else {
                this.ctx.debug('Workspace does not exist on server');
                return Q(0)
            }
        })
        .then((code: number) => {
            if (this.enlistmentExists()) {
                return utilm.exec('rm -fr ' + this.targetPath)
                .then((ret) => { return ret.code});
            } else {
                this.ctx.debug('Skip delete nonexistent local source directory');
                return Q(0); 
            }
        });
    }

    private _getWorkspaceName(): string {
        var agentId = this.ctx.config.agent.id;
        var workspaceName = ("ws_" + this.hash + "_" + agentId).slice(0,60);
        this.ctx.info("workspace name: " + workspaceName);

        return workspaceName;
    }

    private _ensurePathExist(path: string) {
        if (!shell.test('-d', path)) {
            this.ctx.debug("mkdir -p " + path);
            shell.mkdir("-p", path); 
        }
    }

    private _rootingWildcardPath(path: string): string {
        if (path.indexOf('*') > -1) {  
            return path.slice(0, path.indexOf('*'));
        }

        return path;
    }

    private _getCommonPath(commonPath: string, serverPath: string): string {
        var commonPathSegments = commonPath.split('/');
        var pathSegments = serverPath.split('/');

        var commonSegments: string[] = [];
        var idx = 0;
        while (idx < commonPathSegments.length && idx < pathSegments.length 
                && commonPathSegments[idx] === pathSegments[idx]) {
           commonSegments = commonSegments.concat(commonPathSegments[idx]); 
           idx++;
        }

        return path.join.apply(null, commonSegments);
    }

    private _getCommonRootPath(definitionMappings): string {
        var serverPaths: string[] = definitionMappings.map((mapping) => {
            return this._rootingWildcardPath(mapping["serverPath"])
        });

        var commonPath = serverPaths[0];

        serverPaths.forEach((serverPath) => {
            commonPath = this._getCommonPath(path.normalize(commonPath), path.normalize(serverPath));

            if (!commonPath) {
                return false; 
            }
        })

        return commonPath;
    }

    private _createLocalPath(mapping: string, commonPath: string): string {
        var serverPath = mapping["serverPath"];
        var rootedServerPath = this._rootingWildcardPath(serverPath.slice(commonPath.length));
        var localPath = path.join(this.targetPath, rootedServerPath); 

        this._ensurePathExist(localPath);

        return localPath;
    }

    private _getTfvcMappings(endpoint: agentifm.ServiceEndpoint) {
        if (endpoint && endpoint.data && endpoint.data['tfvcWorkspaceMapping']) {
            var tfvcMappings = JSON.parse(endpoint.data['tfvcWorkspaceMapping']);
            if (tfvcMappings && tfvcMappings.mappings) {
                var commonRootPath = this._getCommonRootPath(tfvcMappings.mappings);
                this.ctx.info('common path for mapping: ' + commonRootPath);
                return tfvcMappings.mappings.map((buildDefMap) => {
                    var serverPath = buildDefMap["serverPath"];
                    return <tfvcwm.TfvcMapping>{
                        type: buildDefMap["mappingType"],
                        serverPath: serverPath,
                        localPath: this._createLocalPath(buildDefMap, commonRootPath)
                    }
                });
            }
        }

        return [];
    }
}
