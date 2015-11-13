# Troubleshooting

The agent sends logs to the server but some failures such as configuration, networking or permissions prevent that.  It requires investigating within the agent.

Often these logs are most relevant to the product but they can sometimes provide hints to a user as what could be wrong.

## Agent Trace Logs

The agent has two parts.  The agent which listens to the build queue.  When it gets a build message, it creates a worker process to run that build.  

Agent logs: 
agent/_diag

Worker logs (1 per build):
agent/_work/_diag

If the agent isn't picking up builds, the agent logs are likely the most relevant.  If a build starts running and you want to get details.


## Http Tracing

It's easy to capture the http trace of the agent using Charles Proxy (similar to Fiddler on windows).  

[ VIDEO: Troubleshooting the agent with HTTP Tracing] ( https://www.youtube.com/watch?v=PAVG50t_1bw )

Start Charles Proxy
Charles: Proxy > Proxy Settings > SSL Tab.  Enable.  Add URL
Charles: Proxy > Mac OSX Proxy.  Recommend disabling to only see agent traffic.

```bash
export HTTP_PROXY=http://localhost:8888
```

Run the agent interactively.


**SECURITY NOTE**
HTTP traces and trace files can contain credentials.  

1. Do not POST them on a publically accessible site.
2. If you send them to the product team, they will be treated securely and discarded after the investigation.

There are ways to mitigate it (VSO):
- Use PAT tokens.  It's possible to create a PAT token for the agent that's revokable right after the trace/investigation.  This identity only needs permissions to listen to the queue.
- A specific build generates a PAT token for the life of the build and it expires approximately a day after the build is queued.

On-Premise:
- On prem currently uses basic auth with a real identity.  The only mitigation is to create a temporary account and/or change the password for the trace.  Please don't send us active user credentials.
