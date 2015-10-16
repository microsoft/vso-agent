/// <reference path="../../definitions/shelljs.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />

import Q = require('q');
import agentifm = require('vso-node-api/interfaces/TaskAgentInterfaces');
import shell = require('shelljs');
import cm = require('../../common');
import utilm = require('../../utilities');
import crypto = require('crypto');
import path = require('path');
import fs = require('fs');
import tm = require('../../tracing');

//
// Structure for persisting source mapping information to disk
// See: https://github.com/Microsoft/vso-agent/blob/master/docs/workfolder.md
// 
// all paths are relative making moving working directories less friction
//
export interface ISourceMapping {
  
  // 4/a
  build_artifactstagingdirectory: string;

  // 4/s
  build_sourcesdirectory: string;
    
  // 4
  agent_builddirectory: string;

  // 4\\TestResults
  common_testresultsdirectory: string;

  // 7ca83873-9ab2-43be-86ac-bfb844bf5232
  collectionId: string;
      
  // DefaultCollection
  collectionName: string;

  // 7
  definitionId: string;
    
  // MyDefinition
  definitionName: string;
  
  // 2015-09-22T19:39:41.803Z
  lastRunOn: string;
  
  // sha1 hash of key source provider fields (like url) 
  // used to see if we should create a new source folder
  hashKey: string;
  
  // http://sample.visualstudio.com/DefaultCollection/gitTest/_git/gitTest%20WithSpace
  repositoryUrl: string;
  
  // build
  system: string;    
}

var trace: tm.Tracing;

function ensureTrace(writer: cm.ITraceWriter) {
    if (!trace) {
        trace = new tm.Tracing(__filename, writer);
    }
}

// Mapping info is used primarily for the ever incrementing int for new source folders
export interface ISourceTracking {
    lastBuildFolderCreatedOn: string;
    lastBuildFolderNumber: number;
}

export class SourceMappings {
    constructor(workPath: string, writer: cm.ITraceWriter) {
        ensureTrace(writer);
        trace.enter('SourceMappings()');
        
        this.workPath = workPath;
        this.sourceMappingRootPath = path.join(this.workPath, "SourceRootMapping");
        trace.state('sourceMappingRootPath', this.sourceMappingRootPath);
        this.sourceTrackingPath = path.join(this.sourceMappingRootPath, "Mappings.json");
        trace.state('sourceTrackingPath', this.sourceTrackingPath);
    }

    public workPath: string;
    public sourceMappingRootPath: string;
    public sourceTrackingPath: string;
    public supportsLegacyPaths: boolean;

    public getSourceTracking(): Q.Promise<ISourceTracking> {
        
        var newTrk = <ISourceTracking>{
            lastBuildFolderNumber: 1,
            lastBuildFolderCreatedOn: new Date().toISOString()
        };
        
        shell.mkdir('-p', this.sourceMappingRootPath);
        return utilm.getOrCreateObjectFromFile(this.sourceTrackingPath, newTrk).then((result: utilm.GetOrCreateResult<ISourceTracking>) => {
            return result.result;
        });
    }
    
    public incrementSourceTracking(): Q.Promise<ISourceTracking> {
        var ret: ISourceTracking = null;
        return utilm.objectFromFile(this.sourceTrackingPath)
        .then((trk: any) => {
            ++trk.lastBuildFolderNumber;
            trk.lastBuildFolderCreatedOn = new Date().toISOString();
            ret = trk;
            utilm.objectToFile(this.sourceTrackingPath, trk);
        })
        .then(() => {
            return ret;
        })
    }
    
    public getSourceMapping(hashKey: string,
                            job: agentifm.JobRequestMessage, 
                            endpoint: agentifm.ServiceEndpoint): Q.Promise<ISourceMapping> {

        trace.enter('getSourceMapping');
        var defer = Q.defer();
        
        var expectedMap = <ISourceMapping>{};
        
        var variables = job.environment.variables;
        
        expectedMap.system = variables[cm.vars.system];
        expectedMap.collectionId = variables[cm.vars.systemCollectionId];
        expectedMap.definitionId = variables[cm.vars.systemDefinitionId];
        expectedMap.repositoryUrl = endpoint.url;
        expectedMap.lastRunOn = new Date().toISOString();
        
        //
        // Use old source enlistments if they already exist.  Let's not force a reclone on agent update
        // New workspaces get a shorter path
        //
        var hashInput = expectedMap.collectionId + ':' + expectedMap.definitionId + ':' + endpoint.url;
        var hashProvider = crypto.createHash("sha256");
        hashProvider.update(hashInput, 'utf8');
        var hash = hashProvider.digest('hex');
                
        var legacyDir = path.join('build', hash);
        trace.state('legacyDir', legacyDir);
        fs.exists(legacyDir, (exists: boolean) => {
            if (exists && this.supportsLegacyPaths) {
                trace.write('legacy exists');
                expectedMap.hashKey = hash;
                expectedMap.agent_builddirectory = legacyDir;
                expectedMap.build_sourcesdirectory = path.join(legacyDir, 'repo');
                expectedMap.build_artifactstagingdirectory = path.join(legacyDir, 'artifacts');
                expectedMap.common_testresultsdirectory = path.join(legacyDir, 'TestResults');
                // not setting other informational fields since legacy is not persisted
                trace.state('map', expectedMap);
                defer.resolve(expectedMap);                
            }
            else {
                // non-legacy path
                // TODO: set info fields
                trace.write('using source tracking');
                this.getSourceTracking()
                .then((trk: ISourceTracking) => {
                    trace.state('hashKey', hashKey);
                    expectedMap.hashKey = hashKey;
                    return this.processSourceMapping(expectedMap, trk);                    
                })
                .then((resultMap: ISourceMapping) => {
                    trace.state('resultMap', resultMap);
                    defer.resolve(resultMap);
                })
                .fail((err: Error) => {
                    trace.error(err.message);
                    defer.reject(new Error('Failed creating source map: ' + err.message));
                })                
            }
        })            
        
        return <Q.Promise<ISourceMapping>>defer.promise;
    }
    
    public processSourceMapping(expectedMap: ISourceMapping, trk: ISourceTracking): Q.Promise<ISourceMapping> {
        var resultMap: ISourceMapping;
        var srcMapPath = path.join(this.sourceMappingRootPath
                                    , expectedMap.collectionId
                                    , expectedMap.definitionId);
        
        trace.state('srcMapPath', srcMapPath);                                    
        shell.mkdir('-p', srcMapPath);
        srcMapPath = path.join(srcMapPath, 'SourceFolder.json');
        trace.state('srcMapPath', srcMapPath);
        trace.write('updating expected map');
        this.updateSourceMappingPaths(expectedMap, trk);
        
        return utilm.getOrCreateObjectFromFile(srcMapPath, expectedMap)
        .then((result: utilm.GetOrCreateResult<ISourceMapping>) => {
            var currMap: ISourceMapping = result.result;
            trace.state('curr.hashKey', currMap.hashKey);
            trace.state('expected.hashKey', expectedMap.hashKey);
            
            if (result.created || currMap.hashKey !== expectedMap.hashKey) {
                trace.write('creating new source folder');
                return this.createNewSourceFolder(currMap);
            }
            else {
                trace.write('using current map');
                return currMap;
            }
        })
        .then((map: ISourceMapping) => {
            resultMap = map;
            trace.write('writing map');
            trace.state('map', resultMap);            
            return utilm.objectToFile(srcMapPath, resultMap);
        })
        .then(() => {
            trace.write('done: ' + srcMapPath); 
            return resultMap;
        })
    }
    
    public createNewSourceFolder(map: ISourceMapping) {
        return this.incrementSourceTracking()
        .then((trk: ISourceTracking) => {
            this.updateSourceMappingPaths(map, trk);
            trace.write('ensuring paths exist');
            shell.mkdir('-p', map.agent_builddirectory);
            shell.mkdir('-p', map.build_artifactstagingdirectory);
            shell.mkdir('-p', map.common_testresultsdirectory);
            
            // build_sourcesdirectory: 
            // we are not creating because SCM provider will create (clone etc...)
            trace.write('folders created');
                        
            return map;
        }); 
    }
    
    public updateSourceMappingPaths(map: ISourceMapping, trk: ISourceTracking) {
        trace.enter('updateSourceMappingPaths');
        var rootPath = trk.lastBuildFolderNumber + '';
        map.agent_builddirectory = rootPath;
        map.build_sourcesdirectory = path.join(rootPath, 's');
        map.build_artifactstagingdirectory = path.join(rootPath, 'a');
        map.common_testresultsdirectory = path.join(rootPath, 'TestResults');
        trace.state('map', map);
    }
}