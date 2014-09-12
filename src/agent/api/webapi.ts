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

import ifm = require('./interfaces');
import agentm = require('./agentapi');
import taskm = require('./taskapi');

// ---------------------------------------------------------------------------
// factory to return hostapi (for building build host/agents) or buildapi (for querying and queuing builds)
//----------------------------------------------------------------------------
export function AgentApi(serverUrl: string, handler: ifm.IRequestHandler): ifm.IAgentApi {
	return new agentm.AgentApi(serverUrl, handler);	
}

export function TaskApi(collectionUrl: string, handler: ifm.IRequestHandler): ifm.ITaskApi {
	return new taskm.TaskApi(collectionUrl, handler);	
}
