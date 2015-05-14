# Microsoft Cross Platform Build Agent

Running interactively is good for testing and trying it out.  But, in production the agent should be run as a service
to ensure the agent survives reboots.

## Run as a Service

> OSX only for right now. Linux soon

### Install Service

[OSX Types](https://developer.apple.com/library/mac/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/DesigningDaemons.html#//apple_ref/doc/uid/10000172i-SW4-SW9)

Run in the agent directory

Run as a daemon (OSX | Linux)
```bash
$ ./agent/svc.sh install
```

Run as launch agent (only OSX)
```bash
$ ./agent/svc.sh install agent
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

### Restart
If the service is loaded but you want to stop and start or the host has exited from some reason:
```bash
$ ./svc.sh restart
```

### Uninstall Service
Stop first and then:
```bash
$ ./svc.sh uninstall
```

### Contents

A .service file is created with the information about the service such as where the .plist file is etc...
