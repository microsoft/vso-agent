#Microsoft Cross Platform Build Agent

A cross platform build agent for Microsoft Visual Studio Online (VSO) and Team Foundation Server (TFS).  Supported on Mac OSX and Linux.

##Pre-Reqs

###Node and Npm:
**Mac OSX**: Download and install node from [nodejs.org](http://nodejs.org/)

**Linux**: Install [using package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

From a terminal ensure at least node 0.10 and npm 1.4:
```bash
$ node -v && npm -v
v0.10.29
1.4.14
```

##Agent From Package

Installs the agent installer once globally

```bash
$ sudo npm install install-vsoagent -g
```

###Create Agents

From a directory you created for the agent, run the installer.  Repeat from different folders for multiple agents.

```bash
$ install-vsoagent
```

##Agent From Tar Zip
Create a directory for the agent.  Copy the tar zip into it.
```bash
tar xvzf ./vsoxplat.tar.gz
cd agent
sudo npm install
```

##Provide Permissions to Account

Determine which account the agent will run as.

   1. Enable alternate credentials for account agent will run builds as.
   2. Project Admin UI: (from project, gear upper right) 
      * Ensure queue created.  Name first default. (elect to create a pool if creating)
   3. Collection Admin UI: Security tab, 
      * Add user to Project Collection Build Service Accounts (allows agent to write back build data)
   4. Account Admin (Control Panel): Agent Pools tab, expand pool
      * Add user to Agent Pool Administrators (allows adding agent to pool)
      * Add user to Agent Pool Service Accounts (allows agent to listen to the build queue)

##Configure Agent

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

##Run as a Service

note: only works on OSX right now

###Install Service

```bash
$ sudo node service install
...
Started Successfully
```

###Check Status
```bash
$ sudo node service status
8367	-	com.microsoft.vsoagent
```

note: output is (pid)  (rc)  (name)

###Stop
```bash
$ sudo node service stop
stop: Success.
```

###Start
```bash
$ sudo node service start
start: Success.
```

###Contents
```bash

OSX:
/Library/LaunchDaemons/vsoagent.{accountName}.{agentName}.plist 
```

##Building From Source

###Clone the repo
```bash
git clone <this repo url>
```

###Build Pre-reqs

Typescript is compiled using Jake tasks
```bash
sudo npm install -g typescript
sudo npm install -g jake
```
Install remaining pre-reqs (run from root of repo)
```bash
npm install
```

###Build and Create Package with Jake
run jake in the root of the repo
```bash
$ jake
...
Package done.
```

This creates a _package folder.  Install globally from that folder

###Install Agent
```bash
_package$ sudo npm install ./vsoxplat -g
...
```

Now you can create the agent (section above).

Note:  You can alternatively build and package independantly

```bash
$ jake build
$ jake package
```

###Run Tests
run jake test in the root of the repo
```bash
jake test
```