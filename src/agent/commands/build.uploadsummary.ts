/// <reference path="../definitions/vso-node-api.d.ts" />

import ctxm = require('../context');
import cm = require('../common');
import Q = require('q');
import cmdm = require('./command');
import webapim = require('vso-node-api/WebApi');
import buildifm = require('vso-node-api/interfaces/BuildInterfaces');
import path = require('path');
import fs = require('fs');

export function createAsyncCommand(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
	return new UploadSummaryCommand(executionContext, command);
}

export class UploadSummaryCommand implements cm.IAsyncCommand {
	constructor(executionContext: cm.IExecutionContext, command: cm.ITaskCommand) {
		this.command = command;
		this.executionContext = executionContext;
		this.description = "Upload a build summary document";
	}

	public command: cm.ITaskCommand;
	public description: string;
	public executionContext: cm.IExecutionContext;

	public runCommandAsync(): Q.Promise<any> {
		var filename = this.command.message;
		if (!filename) {
			return Q(null);
		}
		
		var deferred = Q.defer();
		fs.exists(filename, (exists: boolean) => {
			if (!exists) {
				deferred.resolve(null);
			}
			
			var projectId: string = this.executionContext.variables[ctxm.WellKnownVariables.projectId];
			var buildId: number = parseInt(this.executionContext.variables[ctxm.WellKnownVariables.buildId]);
			var type = "DistributedTask.Core.Summary";
			var name = "CustomMarkDownSummary-" + path.basename(filename);
			
			var webapi = this.executionContext.getWebApi();
			var taskClient = webapi.getQTaskApi();
			
			fs.stat(filename, (err: NodeJS.ErrnoException, stats: fs.Stats) => {
				if (err) {
					deferred.reject(err);
				}
				else {
					var headers = {};
					headers["Content-Length"] = stats.size;
					var stream = fs.createReadStream(filename);
			
					taskClient.createAttachment(
						headers,
						stream,
						projectId,
						"Build",
						this.executionContext.jobInfo.planId,
						this.executionContext.jobInfo.timelineId,
						this.executionContext.recordId,
						type,
						name).then(() => deferred.resolve(null), (err: any) => deferred.reject(err));
				}
			})
		});
		
		return deferred.promise;
	}	
}
