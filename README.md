#Microsoft Cross Platform Build Agent

A cross platform build agent for Microsoft Visual Studio Online (VSO) and Team Foundation Server (TFS).

* [`Pre-Reqs`](#prereqs)
* [`Installer From Package`](#installer)
* [`Create Agent`](#create)
* [`Configure Agent`](#configure)
* [`Run As A Service`](#service)
* [`Build From Source`](#build)

##Pre-Reqs
<a name="prereqs" />

###Node and Npm:
**Mac OSX**: Download and install node from http://nodejs.org/
**Linux**: https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager

From a terminal ensure at least node 0.10 and npm 1.4:
```bash
$ node -v
v0.10.28

$ npm -v
1.4.5
```

##Installer From Package
<a name="installer" />

```bash
$ sudo npm install install-vsoagent -g
```

##Create Agent
<a name="create" />

From a directory you created for the agent, run the installer.

```bash
$ install-vsoagent
```

##Configure Agent
<a name="configure" />

Run the agent from the agent folder.
note: if the agent isn't configured, on first run, it will configure

```bash
$ node vsoagent

Enter poolName(enter sets default) > 
Enter serverUrl > https://bryanmac.visualstudio.com
...
Config saved
Waiting ...
```

Change Configuration Later:
```bash
$ node configure
```

##Run as a Service
<a name="service" />

note: only works on OSX right now

###Install Service

```bash
$ sudo node service install
Enter alternate username > bryanmac
Enter alternate password > ********
Installing Service: com.microsoft.vsoagent
Location: /Library/LaunchDaemons/com.microsoft.vsoagent.plist
Installed Successfully
Started Successfully
```

###Check Status
```bash
$ sudo node service status
8367	-	com.microsoft.vsoagent
```

output is (pid)  (rc)  (name)

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
<a name="build" />

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



Note: You can alternatively cd into _packages/vsoxplat and just run from there
      If you do that, run npm install in that directory.

Note:  You can alternatively build and package independantly

```bash
$ jake build
$ jake package
```


