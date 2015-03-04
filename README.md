# Microsoft Cross Platform Build Agent

A cross platform build agent for Microsoft Visual Studio Online (VSO) and Team Foundation Server (TFS).  Supported on Mac OSX and Linux.

*NOTE: This is for the unreleased build.vnext service which is in preview for a subset of accounts*

## Pre-Reqs

### Node and Npm:
**Mac OSX**: Download and install node from [nodejs.org](http://nodejs.org/)

**Linux**: Install [using package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

From a terminal ensure at least node 0.10 and npm 1.4:
```bash
$ node -v && npm -v
v0.12.0
2.5.1
```

## Agent From Package

Installs the agent installer once globally.

```bash
$ sudo npm install vsoagent-installer -g
```

Update the installer with a new version.  It has been more reliable to uninstall and install
```bash
$ sudo npm uninstall vsoagent-installer -g
$ sudo npm install vsoagent-installer -g
```

This does not update your agents.  It simply pulls down the latest version of the agent installer.
Stop old agents and configure new/updated agents in a new directory.
Updating an agent in place is coming soon.

### Create Agents

From a directory you created for the agent, run the installer.  Repeat from different folders for multiple agents.

```bash
$ vsoagent-installer
```

## Provide Permissions to Account

[>> VIDEO:  Configure Permissions <<](http://youtu.be/VgRpl67nOKU)

Determine which account the agent will run as.

   1. Enable alternate credentials for account agent will run builds as.
   2. Project Admin UI: (from project, gear upper right) 
      * Ensure queue created.  Name first default. (elect to create a pool if creating)
   3. Collection Admin UI: Security tab, 
      * Add user to Project Collection Build Service Accounts (allows agent to write back build data)
   4. Account Admin (Control Panel): Agent Pools tab, expand pool
      * Add user to Agent Pool Administrators (allows adding agent to pool)
      * Add user to Agent Pool Service Accounts (allows agent to listen to the build queue)

## Configure Agent

[>> VIDEO:  OSX Configure - Interactive or Service <<](http://youtu.be/ILJlYGYbXtA)

Run the agent from the agent folder.
Configuration will ask for the username and password of the account the agent will run as.
note: if the agent isn't configured, on first run, it will configure.

```bash
$ node vsoagent

Enter poolName(enter sets default) > 
Enter serverUrl > https://contoso.visualstudio.com
...
Config saved
Waiting ...
```

Change Configuration Later:
```bash
$ node configure
```

## Run as a Service

Run in the agent directory
note: only works on OSX right now

### Install Service

[OSX Types](https://developer.apple.com/library/mac/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/DesigningDaemons.html#//apple_ref/doc/uid/10000172i-SW4-SW9)

Run as a daemon (OSX | Linux)
```bash
$ ./svc.sh install
```

Run as launch agent (only OSX)
```bash
$ ./svc.sh install agent
```
*potentially run UI tests*
[Auto Logon and Lock](http://www.tuaw.com/2011/03/07/terminally-geeky-use-automatic-login-more-securely/)

### Check Status
```bash
$ ./svc.sh status
8367	-	vsoagent.myaccount.agent1
```

*note: 
    output is (pid)  (rc)  (name)
    if it is running pid will have a positive number
    rc is last exit code.  if negative, term signal number.  if postive, err return code from last run.
*

### Stop
```bash
$ ./svc.sh stop
```

### Start
```bash
$ ./svc.sh start
```

### Uninstall Service
Stop first and then:
```bash
$ ./svc.sh uninstall
```

### Contents
```bash

OSX:
/Library/LaunchDaemons/vsoagent.{accountName}.{agentName}.plist 
```

## Building From Source

### Clone the repo
```bash
git clone https://github.com/Microsoft/vso-agent.git
```

### Build Pre-reqs

Gulp is the build engine.  The cli needs to be installed globally
```bash
sudo npm install -g gulp
```
Install remaining pre-reqs and gulp tasks (run from root of repo)
```bash
sudo npm install
```

### Build
run gulp in the root of the repo
```bash
$ gulp
...
[22:58:35] Finished 'default' after 2.39 s
```

This creates a _package which is what is pushed to npm. 

## Install from _package

This installs from a local package instead of pulling from npm.
```bash
cd _package
$ sudo npm install ./vsoxplat -g
```
Go to Create Agent above.

### Run Tests
Run all suites:
```bash
gulp test
```

Test agent and tasks:
```bash
gulp test --suite builds
```

Test vso-task-lib:
```bash
gulp test --suite tasklib
```