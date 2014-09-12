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

##Installer From Package

Installs the agent installer once globally

```bash
$ sudo npm install install-vsoagent -g
```

##Create Agent

From a directory you created for the agent, run the installer.  Repeat for multiple agents.

```bash
$ install-vsoagent
```

##Configure Agent

Run the agent from the agent folder.
note: if the agent isn't configured, on first run, it will configure

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
$ cat /Library/LaunchDaemons/com.microsoft.vsoagent.plist 
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

###Build and Create Package with Jake
```bash
run jake in the root of the repo
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

Note:  You can alternatively build and package independantly

```bash
$ jake build
$ jake package
```


