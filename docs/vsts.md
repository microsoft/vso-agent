# VSTS Agent (cloud)

These instructions cover installing and configuring an agent to connect to you Visual Studio Team Services (cloud) account.

## Install

Running this from the command line (terminal) will download prereqs, install/update the agent bits globally and create an agent in your current directory.  Make a new directory for your agent

Copy and paste the curl line.  If your linux box does not have curl [follow this answer](http://askubuntu.com/questions/259681/the-program-curl-is-currently-not-installed)

```bash
mkdir myagent
cd my agent

curl -sSL https://raw.githubusercontent.com/Microsoft/vso-agent/master/getagent.sh | sh
```
Your output should look [similar to this](sampleoutput.md)

 

