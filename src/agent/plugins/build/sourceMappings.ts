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
  lastRun: string;
  
  // sha1 hash of key source provider fields (like url) 
  // used to see if we should create a new source folder
  hashKey: string;
  
  // http://sample.visualstudio.com/DefaultCollection/gitTest/_git/gitTest%20WithSpace
  repositoryUrl: string;
  
  // build
  system: string;    
}

// Mapping info is used primarily for the ever incrementing int for new source folders
export interface ISourceTracking {
    lastBuildFolderCreatedOn: string;
    lastBuildFolderNumber: number;
}

export class SourceMappings {
    constructor(workPath: string) {
        this.workPath = workPath;
        this.sourceMappingRootPath = path.join(this.workPath, "SourceRootMapping");
        this.sourceTrackingPath = path.join(this.sourceMappingRootPath, "Mappings.json");
    }

    public workPath: string;
    public sourceMappingRootPath: string;
    public sourceTrackingPath: string;

    public getSourceTracking(): Q.Promise<ISourceTracking> {
        var defer = Q.defer();
        
        var newTrk = <ISourceTracking>{
            lastBuildFolderNumber: 1,
            lastBuildFolderCreatedOn: new Date().toISOString()
        };
        
        shell.mkdir('-p', this.sourceMappingRootPath);
        return utilm.getOrCreateObjectFromFile(this.sourceTrackingPath, newTrk);
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

        var defer = Q.defer();
        
        var expectedMap = <ISourceMapping>{};
        
        var variables = job.environment.variables;
        
        expectedMap.system = variables[cm.vars.system];
        expectedMap.collectionId = variables[cm.vars.systemCollectionId];
        expectedMap.definitionId = variables[cm.vars.systemDefinitionId];
        expectedMap.repositoryUrl = endpoint.url;
        expectedMap.lastRun = new Date().toISOString();
        
        //
        // Use old source enlistments if they already exist.  Let's not force a reclone on agent update
        // New workspaces get a shorter path
        //
        var hashInput = expectedMap.collectionId + ':' + expectedMap.definitionId + ':' + endpoint.url;
        var hashProvider = crypto.createHash("sha256");
        hashProvider.update(hashInput, 'utf8');
        var hash = hashProvider.digest('hex');
                
        var legacyDir = path.join('build', hash);
        fs.exists(legacyDir, (exists: boolean) => {
            if (exists) {
                expectedMap.hashKey = hash;
                expectedMap.agent_builddirectory = legacyDir;
                expectedMap.build_sourcesdirectory = path.join(legacyDir, 'repo');
                expectedMap.build_artifactstagingdirectory = path.join(legacyDir, 'artifacts');
                expectedMap.common_testresultsdirectory = path.join(legacyDir, 'TestResults');
                // not setting other informational fields since legacy is not persisted
                
                defer.resolve(expectedMap);                
            }
            else {
                // non-legacy path
                // TODO: set info fields
                
                this.getSourceTracking()
                .then((trk: ISourceTracking) => {
                    expectedMap.hashKey = hashKey;
                    return this.processSourceMapping(expectedMap, trk);                    
                })
                .then((resultMap: ISourceMapping) => {
                    defer.resolve(resultMap);
                })
                .fail((err) => {
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
                                    
        shell.mkdir('-p', srcMapPath);
        srcMapPath = path.join(srcMapPath, 'SourceFolder.json');
        
        return utilm.getOrCreateObjectFromFile(srcMapPath, expectedMap)
        .then((currMap: ISourceMapping) => {
            if (currMap.hashKey !== expectedMap.hashKey) {
                return this.createNewSourceFolder(currMap);
            }
            else {
                return currMap;
            }
        })
        .then((map: ISourceMapping) => {
            resultMap = map;            
            return utilm.objectToFile(srcMapPath, resultMap);
        })
        .then(() => {
            return resultMap;
        })
    }
    
    public createNewSourceFolder(map: ISourceMapping) {
        return this.incrementSourceTracking()
        .then((trk: ISourceTracking) => {
            this.updateSourceMappingPaths(map, trk);
            shell.mkdir('-p', map.agent_builddirectory);
            return map;
        }); 
    }
    
    public updateSourceMappingPaths(map: ISourceMapping, trk: ISourceTracking) {
        var rootPath = trk.lastBuildFolderNumber + '';
        map.agent_builddirectory = rootPath;
        map.build_sourcesdirectory = path.join(rootPath, 's');
        map.build_artifactstagingdirectory = path.join(rootPath, 'a');
        map.common_testresultsdirectory = path.join(rootPath, 'TestResults');
    }
}