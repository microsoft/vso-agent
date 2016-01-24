# VSTS Agent (visualstudio.com)

These instructions cover installing and configuring an agent to connect to you Visual Studio Team Services (cloud) account.

## Account and Roles

Create a PAT token.  [Step by Step here](http://roadtoalm.com/2015/07/22/using-personal-access-tokens-to-access-visual-studio-online/)

Add the user you created the PAT token for to *both*:

  1. Agent Pool Administrators (allows to register)
  2. Agent Pool Service Accounts (allows listening to build queue)

![Agent Roles](roles.png "Agent Roles")

>> TIPS:
>> You can add to roles for a specific pool or select "All Pools" on the left and grant for all pools.  This allows the account owner to delegate build administration globally or for specific pools.  [More here](https://msdn.microsoft.com/en-us/Library/vs/alm/Build/agents/admin)
>> The PAT token is only used to listen to the message queue for a build job
>> When a build is run, it will generate an OAuth token for the scoped identity selected on the general tab of the build definition.  That token is short lived and will be used to access resource in VSTS


## Install

Running this from the command line (terminal) will download prereqs, install/update the agent bits globally and create an agent in your current directory.  Make a new directory for your agent

> Tips 
> Directory should be created under the users home directory (~).  
> Prefer running the agent as the logged in user and creating under ~ will minimize permission issues.

Copy and paste the curl line.  If your linux box does not have curl [follow this answer](http://askubuntu.com/questions/259681/the-program-curl-is-currently-not-installed)

From a terminal:
```bash
mkdir myagent
cd my agent

curl -skSL http://aka.ms/xplatagent | bash
```

To install preview version (usually master), use:

```bash
curl -skSL http://aka.ms/previewxplat | bash
```

Your output should look [similar to this](sampleoutput.md)

### Configure on first run

>> TIPS:
>> ensure it's account level url (no collection)
>> for VSTS, ensure you answer false (default) for force basic
>> if the agent isn't configured (.agent file exists), on first run, it will configure.

```bash
$ ./run.sh
Enter alternate username > somerandomusername
Enter alternate password > (copy paste PAT token here)
Enter agent name (enter sets yourmac.local)  > 
Enter agent pool name (enter sets default)  > 
Enter poolName(enter sets default) > 
Enter serverUrl > https://contoso.visualstudio.com
...
Enter force basic (enter is false)  > 
Config saved
Waiting ...
```

An agent is now running interactively.  ctrl-c will exit the agent.

## Update Existing Agent

Run the same command used to install from the agent root directory (package.json will be in that folder)

Before updating stop the agent (ctrl-c if interactive, if service [see run as a service](service.md))

From a terminal:
```bash
curl -skSL http://aka.ms/xplatagent | bash
```
Your output should look [similar to this](sampleoutput.md)

## Run as a Service

Running interactively is good for testing and evaluation.  But, in production the agent should be run as a service
to ensure the agent survives reboots.

[How to run as a service](service.md)




