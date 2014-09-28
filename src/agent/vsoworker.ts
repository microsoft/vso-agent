// 
// Copyright (c) Microsoft and contributors.  All rights reserved.
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// 
// See the License for the specific language governing permissions and
// limitations under the License.
// 

/// <reference path="./definitions/node.d.ts"/>

import cfgm = require('./configuration');
import cm = require('./common');
import ctxm = require('./context');
import dm = require('./diagnostics');
import ifm = require('./api/interfaces');
import jrm = require("./job");
import fm = require('./feedback');
import os = require('os');
import tm = require('./tracing');
import path = require('path');

var ag: ctxm.AgentContext;
var trace: tm.Tracing;

function setVariables(job: ifm.JobRequestMessage, agentContext: ctxm.AgentContext) {
	trace.enter('setVariables');
	trace.state('variables', job.environment.variables);

    var workFolder = agentContext.config.settings.workFolder;
    if (!workFolder.startsWith('/')) {
        workFolder = path.join(__dirname, agentContext.config.settings.workFolder);
    }

	var sys = job.environment.variables['sys'];
	var collId = job.environment.variables['sys.collectionId'];
	var defId = job.environment.variables['sys.definitionId'];

	var workingFolder = path.join(workFolder, sys, collId, defId);
	job.environment.variables['sys.workFolder'] = workFolder;
	job.environment.variables['sys.workingFolder'] = workingFolder;

    var stagingFolder = path.join(workingFolder, 'staging');
	job.environment.variables['sys.staging'] = stagingFolder;

	trace.state('variables', job.environment.variables);
}

//
// Worker process waits for a job message, processes and then exits
//
process.on('message',function(msg){
	ag = new ctxm.AgentContext('worker', msg.config);
	trace = new tm.Tracing(__filename, ag);
	trace.enter('.onMessage');
	trace.state('message', msg);

	ag.info('worker::onMessage');
	if (msg.messageType === "job") {
		var job: ifm.JobRequestMessage = msg.data;
		setVariables(job, ag);

		var jobInfo: cm.IJobInfo = cm.jobInfoFromJob(job);

		// TODO: on output from context --> diag
        // TODO: these should be set beforePrepare and cleared postPrepare after we add agent ext
        if (msg.config && msg.config.creds) {
            process.env['altusername'] = msg.config.creds.username;
            process.env['altpassword'] = msg.config.creds.password;    
        }

		ag.status('Running job: ' + job.jobName);
		ag.info('message:');
		trace.state('msg:', msg);

		var agentUrl = ag.config.settings.serverUrl;
		var taskUrl = job.authorization.serverUrl;
		var feedback: cm.IFeedbackChannel = new fm.ServiceChannel(agentUrl, taskUrl, jobInfo, ag);
		trace.write('created feedback');

		var ctx: ctxm.JobContext = new ctxm.JobContext(job, feedback, ag);
		trace.write('created JobContext');

		var jobRunner: jrm.JobRunner = new jrm.JobRunner(ag, ctx);
		trace.write('created jobRunner');

		jobRunner.run((err: any, result: ifm.TaskResult) => {
			trace.callback('job.run');

			ag.status('Job Completed: ' + job.jobName);
            if (err) {
                ag.error('Error: ' + err.message);
            }

			ctx.finishJob(result, (err: any)  => {
				trace.callback('ctx.finishJob');

				ag.status('Job Finished: ' + job.jobName);
	            if (err) {
	                ag.error('Error: ' + err.message);
	            }

	            // At this point, the job is done so the server can send another.
	            // process will not exit until the job is done.
				ag.status('Finish Uploading Logs ...');

				// ag.finishLogs()
				ctx.finishLogs((err:any) => {
					if (err) {
		                ag.error('Error: ' + err.message);
		            }

					process.exit();
				});
			});

		});
	}
});


process.on('uncaughtException', function(err) {
	if (ag) {
		ag.error('worker unhandled: ' + err.message);
	}

	process.exit();	
});

process.on('SIGINT', function() {
	if (ag) {
		ag.info( "\nShutting down agent." );
	}

	process.exit();
})
