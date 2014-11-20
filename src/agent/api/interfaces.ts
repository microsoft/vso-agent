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

// ---------------------------------------------------------------------------
// API Client Interfaces
//----------------------------------------------------------------------------

/// <reference path="../definitions/node.d.ts" />

export interface IAgentApi {
    accountUrl: string;
    httpClient: IHttpClient;
    restClient: IRestClient;
    connect(onResult: (err: any, statusCode: number, obj: any) => void): void;
    getMessage(poolId: number, sessionId: string, onResult: (err: any, statusCode: number, message: any) => void): void;
    deleteMessage(poolId: number, sessionId: string, messageId: number, onResult: (err: any, statusCode: number) => void): void;
    getAgentPools(poolName: string, onResult: (err: any, statusCode: number, pools: TaskAgentPool[]) => void): void;
    getAgents(poolId: number, agentName: string, onResult: (err: any, statusCode: number, agents: TaskAgent[]) => void): void;
    createAgent(poolId: number, agent: TaskAgent, onResult: (err: any, statusCode: number, agent: TaskAgent) => void): void;
    updateAgent(poolId: number, agent: TaskAgent, onResult: (err: any, statusCode: number, agent: TaskAgent) => void): void;
    createSession(poolId: number, session: TaskAgentSession, onResult: (err: any, statusCode: number, session: TaskAgentSession) => void): void;
    deleteSession(poolId: number, sessionId: string, onResult: (err: any, statusCode: number) => void): void;
    updateJobRequest(poolId: number, lockToken: string, jobRequest: TaskAgentJobRequest, onResult: (err: any, statusCode: number, jobRequest: TaskAgentJobRequest) => void): void;
}

export interface ITimelineApi {
    updateTimelineRecords(planId: string, timelineId: string, record: TimelineRecord[], onResult: (err: any, statusCode: number, records: TimelineRecord[]) => void): void;
    appendTimelineRecordFeed(planId: string, timelineId: string, recordId: string, lines: string[], onResult: (err: any, statusCode: number, obj: any) => void): void;
    createLog(planId: string, logPath: string, onResult: (err: any, statusCode: number, log: TaskLog) => void): void;
    uploadLogFile(planId: string, logId: number, filePath: string, onResult: (err: any, statusCode: number, obj: any) => void): void;    
}

export interface ITaskApi {
    getTasks(taskId: string, onResult: (err: any, statusCode: number, obj: any) => void): void;
    downloadTask(taskId: string, version: string, filePath: string, onResult: (err: any, statusCode: number) => void): void
}

export interface IRequestHandler {
    prepareRequest(options: any): void;
}

export interface IHttpResponse {
    statusCode: number;
    headers: any;
}

export interface IHttpClient {
    get(verb: string, requestUrl: string, headers: any, onResult: (err: any, res: IHttpResponse, contents: string) => void): void;
    send(verb: string, requestUrl: string, objs: any, headers: any, onResult: (err: any, res: IHttpResponse, contents: string) => void): void;
    sendFile(verb: string, requestUrl: string, content: NodeJS.ReadableStream, headers: any, onResult: (err: any, res: IHttpResponse, contents: string) => void): void;
    getFile(requestUrl: string, destination: NodeJS.WritableStream, headers: any, onResult: (err: any, res: IHttpResponse) => void): void
    request(protocol: any, options: any, body, onResult: (err: any, res: IHttpResponse, contents: string) => void): void;
}

export interface IRestClient {
    baseUrl: string;
    httpClient: IHttpClient;
    getJson(relativeUrl: string, onResult: (err: any, statusCode: number, obj: any) => void): void;
    getJsonWrappedArray(relativeUrl: string, onResult: (err: any, statusCode: number, obj: any) => void): void;
    create(relativeUrl: string, resources: any, onResult: (err: any, statusCode: number, obj: any) => void): void;
    createJsonWrappedArray(relativeUrl: string, resources: any[], onResult: (err: any, statusCode: number, obj: any) => void): void;
    update(relativeUrl: string, resources: any, onResult: (err: any, statusCode: number, obj: any) => void): void;
    updateJsonWrappedArray(relativeUrl: string, resources: any[], onResult: (err: any, statusCode: number, obj: any) => void): void;
    uploadFile(relativeUrl: string, filePath: string, onResult: (err: any, statusCode: number, obj: any) => void): void;
    replace(relativeUrl: string, resources: any, onResult: (err: any, statusCode: number, obj: any) => void): void;
}

// ---------------------------------------------------------------------------
// Job Message Interfaces
//----------------------------------------------------------------------------

export interface TaskInputs {
    [key: string]: string;
}

export interface JobVariables {
    [key: string]: string;
}


//*******************************************************************************************************
// DO NOT EDIT BELOW THIS POINT
// copied from: WebAccess\Presentation\Scripts\TFS\Generated\TFS.DistributedTask.Constants.ts
//*******************************************************************************************************


//----------------------------------------------------------
// Copyright (C) Microsoft Corporation. All rights reserved.
//----------------------------------------------------------

//----------------------------------------------------------
// Generated file, DO NOT EDIT.

// Generated data for the following assemblies:
// Microsoft.TeamFoundation.DistributedTask.WebApi
//----------------------------------------------------------


export module TaskResourceIds {
    export var Agents = "e298ef32-5878-4cab-993c-043836571f42";
    export var AgentMessages = "c3a054f6-7a8a-49c0-944e-3a8e5d7adfd7";
    export var AgentSessions = "134e239e-2df3-4794-a6f6-24f1f19ec8dc";
    export var Capabilities = "30ba3ada-fedf-4da8-bbb5-dacf2f82e176";
    export var Logs = "15344176-9e77-4cf4-a7c3-8bc4d0a3c4eb";
    export var Plans = "f8d10759-6e90-48bc-96b0-d19440116797";
    export var Pools = "a8c47e17-4d56-4a56-92bb-de7ea7dc65be";
    export var Requests = "57af3969-93ca-47e9-93f6-63b124e8ff30";
    export var JobRequests = "fc825784-c92a-4299-9221-998a02d1b54f";
    export var Tasks = "60aac929-f0cd-4bc8-9ce4-6b30e8f1b1bd";
    export var TaskIcons = "63463108-174d-49d4-b8cb-235eea42a5e1";
    export var LogsIndex = "5f1e0bb7-84a9-43d3-b1ae-a2f241c6f01a";
    export var Timelines = "ffe38397-3a9d-4ca6-b06d-49303f287ba5";
    export var TimelineRecords = "50170d5d-f122-492f-9816-e2ef9f8d1756";
    export var TimelineRecordFeeds = "9ae056f6-d4e4-4d0c-bd26-aee2a22f01f2";
    export var Area = "distributedtask";
    export var AgentsResource = "agents";
    export var AgentMessagesResource = "messages";
    export var AgentSessionsResource = "sessions";
    export var CapabilitiesResource = "capabilities";
    export var LogsResource = "logs";
    export var PlansResource = "plans";
    export var PoolsResource = "pools";
    export var RequestsResource = "requests";
    export var JobRequestsResource = "jobrequests";
    export var TasksResource = "tasks";
    export var TaskIconsResource = "icon";
    export var LogsIndexResource = "index";
    export var TimelinesResource = "timelines";
    export var TimelineRecordsResource = "records";
    export var TimelineRecordFeedsResource = "feed";
}

export interface JobAssignedEvent {
    jobId: string;
    request: TaskAgentJobRequest;
}

export interface JobAuthorization {
    serverId: string;
    serverUrl: any;
    servicePrincipalId: string;
    servicePrincipalToken: string;
}

export interface JobCompletedEvent {
    jobId: string;
    result: TaskResult;
}

export interface JobEndpoint {
    authorization: string;
    data: { [key: string]: string; };
    id: number;
    name: string;
    type: string;
    url: string;
}

export interface JobEnvironment {
    data: any;
    endpoints: JobEndpoint[];
    options: { [key: string]: JobOption; };
    secrets: any;
    variables: { [key: string]: string; };
}

export interface JobEvent {
    jobId: string;
}

export interface JobOption {
    data: { [key: string]: string; };
    id: string;
}

export interface JobRequestMessage {
    authorization: JobAuthorization;
    environment: JobEnvironment;
    jobId: string;
    jobName: string;
    lockedUntil: Date;
    lockToken: string;
    plan: TaskOrchestrationPlanReference;
    requestId: any;
    tasks: TaskInstance[];
    timeline: TimelineReference;
}

export interface JobStartedEvent {
    jobId: string;
    lockExpirationTime: Date;
}

export interface RunPlanInput {
    environment: JobEnvironment;
    hostId: string;
    implementation: TaskOrchestrationContainer;
    planId: string;
    poolId: number;
}

export interface TaskAgent {
    createdOn: Date;
    id: number;
    maxParallelism: number;
    name: string;
    properties: any;
    status: TaskAgentStatus;
    statusChangedOn: Date;
    systemCapabilities: { [key: string]: string; };
    userCapabilities: { [key: string]: string; };
}

export interface TaskAgentJobRequest {
    assignTime: Date;
    finishTime: Date;
    hostId: string;
    jobId: string;
    lockedUntil: Date;
    planId: string;
    queueTime: Date;
    receiveTime: Date;
    requestId: any;
    reservedAgent: TaskAgentReference;
    result: TaskResult;
}

export interface TaskAgentMessage {
    body: string;
    messageId: any;
    messageType: string;
}

export interface TaskAgentPool {
    createdOn: Date;
    id: number;
    name: string;
    properties: any;
    scope: string;
    size: number;
}

export interface TaskAgentPoolReference {
    id: number;
    name: string;
    scope: string;
}

export interface TaskAgentReference {
    id: number;
    name: string;
}

export interface TaskAgentSession {
    agent: TaskAgentReference;
    ownerName: string;
    sessionId: string;
}

export enum TaskAgentStatus {
    Offline = 1,
    Online = 2,
}

export enum TaskCategory {
    None = 0,
    Utility = 1,
    Build = 2,
    Test = 3,
    Deploy = 4,
}

export interface TaskDefinition {
    agentExecution: TaskExecution;
    author: string;
    category: TaskCategory;
    contentsUploaded: boolean;
    demands: any[];
    description: string;
    friendlyName: string;
    hostType: string;
    iconUrl: string;
    id: string;
    inputs: TaskInputDefinition[];
    instanceNameFormat: string;
    name: string;
    packageLocation: string;
    packageType: string;
    serverOwned: boolean;
    sourceLocation: string;
    version: TaskVersion;
}

export interface TaskExecution {
    execTask: TaskReference;
    platformInstructions: { [key: string]: { [key: string]: string; }; };
}

export interface TaskInputDefinition {
    defaultValue: string;
    label: string;
    name: string;
    required: boolean;
    type: TaskInputType;
}

export enum TaskInputType {
    String = 0,
    Repository = 1,
    Boolean = 2,
    KeyValue = 3,
}

export interface TaskInstance {
    displayName: string;
    id: string;
    inputs: { [key: string]: string; };
    instanceId: string;
    name: string;
    version: string;
}

export interface TaskLog {
    createdOn: Date;
    id: number;
    indexLocation: any;
    lastChangedOn: Date;
    lineCount: any;
    location: any;
    path: string;
}

export interface TaskLogReference {
    id: number;
    location: any;
}

export interface TaskOrchestrationContainer {
    children: TaskOrchestrationItem[];
    itemType: TaskOrchestrationItemType;
    parallel: boolean;
}

export interface TaskOrchestrationItem {
    itemType: TaskOrchestrationItemType;
}

export enum TaskOrchestrationItemType {
    Container = 0,
    Job = 1,
}

export interface TaskOrchestrationJob {
    demands: any[];
    instanceId: string;
    itemType: TaskOrchestrationItemType;
    name: string;
    tasks: TaskInstance[];
    variables: { [key: string]: string; };
}

export interface TaskOrchestrationPlan {
    artifactLocation: any;
    artifactUri: any;
    environment: JobEnvironment;
    finishTime: Date;
    implementation: TaskOrchestrationContainer;
    planId: string;
    result: TaskResult;
    resultCode: string;
    startTime: Date;
    state: TaskOrchestrationRequestState;
    timeline: TimelineReference;
}

export interface TaskOrchestrationPlanReference {
    artifactLocation: any;
    artifactUri: any;
    planId: string;
}

export interface TaskOrchestrationRequest {
    artifactUri: any;
    finishTime: Date;
    hostId: string;
    planId: string;
    queueTime: Date;
    startTime: Date;
    state: TaskOrchestrationRequestState;
}

export enum TaskOrchestrationRequestState {
    InProgress = 1,
    Queued = 2,
    Completed = 4,
}

export interface TaskReference {
    id: string;
    inputs: { [key: string]: string; };
    name: string;
    version: string;
}

export enum TaskResult {
    Succeeded = 0,
    SucceededWithIssues = 1,
    Failed = 2,
    Cancelled = 3,
    Skipped = 4,
    Abandoned = 5,
}

export interface TaskVersion {
    isTest: boolean;
    major: number;
    minor: number;
    patch: number;
}

export interface Timeline {
    changeId: number;
    id: string;
    lastChangedBy: string;
    lastChangedOn: Date;
    location: any;
    records: TimelineRecord[];
}

export interface TimelineRecord {
    changeId: number;
    currentOperation: string;
    details: TimelineReference;
    finishTime: Date;
    id: string;
    lastModified: Date;
    location: any;
    log: TaskLogReference;
    name: string;
    parentId: string;
    percentComplete: number;
    result: TaskResult;
    resultCode: string;
    startTime: Date;
    state: TimelineRecordState;
    type: string;
    workerName: string;
}

export enum TimelineRecordState {
    Pending = 0,
    InProgress = 1,
    Completed = 2,
}

export interface TimelineReference {
    changeId: number;
    id: string;
    location: any;
}

export var TypeInfo = {
    JobAssignedEvent: {
        fields: <any>null
    },
    JobAuthorization: {
        fields: <any>null
    },
    JobCompletedEvent: {
        fields: <any>null
    },
    JobEndpoint: {
        fields: <any>null
    },
    JobEnvironment: {
        fields: <any>null
    },
    JobEvent: {
        fields: <any>null
    },
    JobRequestMessage: {
        fields: <any>null
    },
    JobStartedEvent: {
        fields: <any>null
    },
    RunPlanInput: {
        fields: <any>null
    },
    TaskAgent: {
        fields: <any>null
    },
    TaskAgentJobRequest: {
        fields: <any>null
    },
    TaskAgentMessage: {
        fields: <any>null
    },
    TaskAgentPool: {
        fields: <any>null
    },
    TaskAgentPoolReference: {
        fields: <any>null
    },
    TaskAgentReference: {
        fields: <any>null
    },
    TaskAgentSession: {
        fields: <any>null
    },
    TaskAgentStatus: {
        enumValues: {
            "offline": 1,
            "online": 2,
        }
    },
    TaskCategory: {
        enumValues: {
            "none": 0,
            "utility": 1,
            "build": 2,
            "test": 3,
            "deploy": 4,
        }
    },
    TaskDefinition: {
        fields: <any>null
    },
    TaskExecution: {
        fields: <any>null
    },
    TaskInputDefinition: {
        fields: <any>null
    },
    TaskInputType: {
        enumValues: {
            "string": 0,
            "repository": 1,
            "boolean": 2,
            "keyValue": 3,
        }
    },
    TaskInstance: {
        fields: <any>null
    },
    TaskLog: {
        fields: <any>null
    },
    TaskLogReference: {
        fields: <any>null
    },
    TaskOrchestrationContainer: {
        fields: <any>null
    },
    TaskOrchestrationItem: {
        fields: <any>null
    },
    TaskOrchestrationItemType: {
        enumValues: {
            "container": 0,
            "job": 1,
        }
    },
    TaskOrchestrationJob: {
        fields: <any>null
    },
    TaskOrchestrationPlan: {
        fields: <any>null
    },
    TaskOrchestrationPlanReference: {
        fields: <any>null
    },
    TaskOrchestrationRequest: {
        fields: <any>null
    },
    TaskOrchestrationRequestState: {
        enumValues: {
            "inProgress": 1,
            "queued": 2,
            "completed": 4,
        }
    },
    TaskReference: {
        fields: <any>null
    },
    TaskResult: {
        enumValues: {
            "succeeded": 0,
            "succeededWithIssues": 1,
            "failed": 2,
            "cancelled": 3,
            "skipped": 4,
            "abandoned": 5,
        }
    },
    TaskVersion: {
        fields: <any>null
    },
    Timeline: {
        fields: <any>null
    },
    TimelineRecord: {
        fields: <any>null
    },
    TimelineRecordState: {
        enumValues: {
            "pending": 0,
            "inProgress": 1,
            "completed": 2,
        }
    },
    TimelineReference: {
        fields: <any>null
    }
}

TypeInfo.JobAssignedEvent.fields = {
    request: {
        typeInfo: TypeInfo.TaskAgentJobRequest
    }
}
TypeInfo.JobCompletedEvent.fields = {
    result: {
        enumType: TypeInfo.TaskResult
    }
}
TypeInfo.JobEnvironment.fields = {
    endpoints: {
        isArray: true,
        typeInfo: TypeInfo.JobEndpoint
    }
}
TypeInfo.JobRequestMessage.fields = {
    lockedUntil: {
        isDate: true
    },
    plan: {
        typeInfo: TypeInfo.TaskOrchestrationPlanReference
    },
    timeline: {
        typeInfo: TypeInfo.TimelineReference
    },
    environment: {
        typeInfo: TypeInfo.JobEnvironment
    },
    authorization: {
        typeInfo: TypeInfo.JobAuthorization
    },
    tasks: {
        isArray: true,
        typeInfo: TypeInfo.TaskInstance
    }
}
TypeInfo.JobStartedEvent.fields = {
    lockExpirationTime: {
        isDate: true
    }
}
TypeInfo.RunPlanInput.fields = {
    environment: {
        typeInfo: TypeInfo.JobEnvironment
    },
    implementation: {
        typeInfo: TypeInfo.TaskOrchestrationContainer
    }
}
TypeInfo.TaskAgent.fields = {
    createdOn: {
        isDate: true
    },
    status: {
        enumType: TypeInfo.TaskAgentStatus
    },
    statusChangedOn: {
        isDate: true
    }
}
TypeInfo.TaskAgentJobRequest.fields = {
    queueTime: {
        isDate: true
    },
    assignTime: {
        isDate: true
    },
    receiveTime: {
        isDate: true
    },
    finishTime: {
        isDate: true
    },
    result: {
        enumType: TypeInfo.TaskResult
    },
    lockedUntil: {
        isDate: true
    },
    reservedAgent: {
        typeInfo: TypeInfo.TaskAgentReference
    }
}
TypeInfo.TaskAgentPool.fields = {
    createdOn: {
        isDate: true
    }
}
TypeInfo.TaskAgentSession.fields = {
    agent: {
        typeInfo: TypeInfo.TaskAgentReference
    }
}
TypeInfo.TaskDefinition.fields = {
    version: {
        typeInfo: TypeInfo.TaskVersion
    },
    category: {
        enumType: TypeInfo.TaskCategory
    },
    inputs: {
        isArray: true,
        typeInfo: TypeInfo.TaskInputDefinition
    },
    agentExecution: {
        typeInfo: TypeInfo.TaskExecution
    }
}
TypeInfo.TaskExecution.fields = {
    execTask: {
        typeInfo: TypeInfo.TaskReference
    }
}
TypeInfo.TaskInputDefinition.fields = {
    type: {
        enumType: TypeInfo.TaskInputType
    }
}
TypeInfo.TaskLog.fields = {
    createdOn: {
        isDate: true
    },
    lastChangedOn: {
        isDate: true
    }
}
TypeInfo.TaskOrchestrationContainer.fields = {
    itemType: {
        enumType: TypeInfo.TaskOrchestrationItemType
    },
    children: {
        isArray: true,
        typeInfo: TypeInfo.TaskOrchestrationItem
    }
}
TypeInfo.TaskOrchestrationItem.fields = {
    itemType: {
        enumType: TypeInfo.TaskOrchestrationItemType
    }
}
TypeInfo.TaskOrchestrationJob.fields = {
    itemType: {
        enumType: TypeInfo.TaskOrchestrationItemType
    },
    tasks: {
        isArray: true,
        typeInfo: TypeInfo.TaskInstance
    }
}
TypeInfo.TaskOrchestrationPlan.fields = {
    startTime: {
        isDate: true
    },
    finishTime: {
        isDate: true
    },
    state: {
        enumType: TypeInfo.TaskOrchestrationRequestState
    },
    result: {
        enumType: TypeInfo.TaskResult
    },
    timeline: {
        typeInfo: TypeInfo.TimelineReference
    },
    environment: {
        typeInfo: TypeInfo.JobEnvironment
    },
    implementation: {
        typeInfo: TypeInfo.TaskOrchestrationContainer
    }
}
TypeInfo.TaskOrchestrationRequest.fields = {
    queueTime: {
        isDate: true
    },
    startTime: {
        isDate: true
    },
    finishTime: {
        isDate: true
    },
    state: {
        enumType: TypeInfo.TaskOrchestrationRequestState
    }
}
TypeInfo.Timeline.fields = {
    lastChangedOn: {
        isDate: true
    },
    records: {
        isArray: true,
        typeInfo: TypeInfo.TimelineRecord
    }
}
TypeInfo.TimelineRecord.fields = {
    startTime: {
        isDate: true
    },
    finishTime: {
        isDate: true
    },
    state: {
        enumType: TypeInfo.TimelineRecordState
    },
    result: {
        enumType: TypeInfo.TaskResult
    },
    lastModified: {
        isDate: true
    },
    log: {
        typeInfo: TypeInfo.TaskLogReference
    },
    details: {
        typeInfo: TypeInfo.TimelineReference
    }
}
