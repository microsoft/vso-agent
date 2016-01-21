# Microsoft Cross Platform Build Agent

A cross platform build agent for Microsoft Visual Studio Online (VSO) and Team Foundation Server (TFS).  Supported on Mac OSX and Linux.

Related:[VSO Build Tasks](https://github.com/Microsoft/vso-agent-tasks), [VSO Task SDK](https://github.com/Microsoft/vso-task-lib), [VSO Node API](https://github.com/Microsoft/vso-node-api)

## What's New

**New Release**

A new 0.3.x release includes the following features.  If you have a 0.2.x agent, you should update (see Updating Existing Agents below).  The new release includes:

  * Release Management vNext Support
  * TfsVC xplat support using TEE command line
  * Extensions (collection level tasks via extensions)
  * Pull Request Support
  * SVN support
  * Service Endpoint support
  * Shorter repo paths
  * Summary markdown support

## Pre-Reqs

### Node and Npm:
**Mac OSX**: Download and install node from [nodejs.org](http://nodejs.org/)

**Linux**: Install [using package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

From a terminal ensure at least node 4.2 and npm 2:
```bash
$ node -v && npm -v
v4.2.0
2.5.1
```

## Install the agent installer

Installs the agent installer once globally.  This allows you to stamp out instances of the agent.

```bash
$ sudo npm install vsoagent-installer -g
$ sudo chown -R $USER ~/.npm
```

[more on npm issue](http://stackoverflow.com/questions/22152162/npm-cannot-install-dependencies-attempt-to-unlock-something-which-hasnt-been)

This does not install an agent.  It simply pulls down the latest version of the agent installer.

### On-Premises 2015 Server

Use 0.4@preview for now
```bash
$ sudo npm install vsoagent-installer@preview -g
$ sudo chown -R $USER ~/.npm
```

Basic Auth is required for OSX/Linux Access.  Ensure ssl/https.
[Instructions Here](https://github.com/Microsoft/tfs-cli/blob/master/docs/configureBasicAuth.md)

### Create Agents

From a directory you created for the agent, run the installer.  Repeat from different folders for multiple agents.
Prefer running this from under your home directory (~)

```bash
~$ mkdir myagent; cd myagent
~/myagent$ vsoagent-installer
```

## Configure Agent
[>> Video: Configure VSO Xplat Agent<<](http://youtu.be/_snVbL39kyU)

### Provide Permissions to Account

Determine which account the agent will run as.

   1. Determine the account the agent will use to listen for builds (the queue)
      * (VSTS Online) [Create a presonal access token](http://roadtoalm.com/2015/07/22/using-personal-access-tokens-to-access-visual-studio-online/). Profile in upper right.
      * (On-Premises) Determine the local/domain account used for the build
   2. Account Admin (gear upper right), Control Panel link: Agent Pools tab, expand pool
      * Add user to Agent Pool Administrators (allows adding agent to pool)
      * Add user to Agent Pool Service Accounts (allows agent to listen to the build queue)

### Configure on first run

Run the vsoagent from the agent folder.
Configuration will ask for the username and password of the account the agent will run as.
note: if the agent isn't configured, on first run, it will configure.

```bash
$ node agent/vsoagent
Enter alternate username > someuser
Enter alternate password >
Enter agent name (enter sets yourmac.local)  > 
Enter agent pool name (enter sets default)  > 
Enter poolName(enter sets default) > 
Enter serverUrl > https://contoso.visualstudio.com
...
Enter force basic (enter is false)  > 
Config saved
Waiting ...

VSTS Online should not force basic (enter)
On-Premises TFS Server access should force basic (true)
```

## Run Interactively

To run the agent, simply run vsoagent in the agent directory with node

```bash
$ node agent/vsoagent
```

**Stop using ctrl-c**  The agent cleans up if you do this (sends SIGINT)

The agent will stay running interactively as long as your log on session is active.  
If you want to keep running after you log off, consider running as a service (below), nohup (linux) or a docker container.

To test out, we recommend running interactively.  It's also useful for running UI/emulator tests that require gui interaction.  (LaunchAgent other option below)

## Run as a Service

Running interactively is good for testing and evaluation.  But, in production the agent should be run as a service
to ensure the agent survives reboots.

[How to run as a service](docs/service.md)

### Update Existing Agents

Repeat the same steps to update the agent.  This will update the installer to the latest version.

```bash
$ sudo npm install vsoagent-installer -g
```

Go to the directory you created for the agent and run the same command you used to create the agent.

**IMPORTANT:** that directory should have a package.json file in it and a sub folder named agent.

```bash
$ vsoagent-installer
```

NOTE: Updating the agent will overwrite the code in the agent subfolder and update the package.json 

## Install previously released agents

The previously released stable agent was 0.2.29

```bash
$ sudo npm install vsoagent-installer@0.2.29 -g
$ sudo chown -R $USER ~/.npm
```

[more on npm issue](http://stackoverflow.com/questions/22152162/npm-cannot-install-dependencies-attempt-to-unlock-something-which-hasnt-been)

This does not install an agent.  It simply pulls down the latest version of the agent installer.

## Troubleshooting

[How to Troubleshoot](docs/troubleshooting.md)

## Contributing

[How to contribute](docs/contribute.md)
