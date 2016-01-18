# On Premises Server

These instructions cover installing and configuring an agent to connect to your on premises Team Foundation Server 2015 or later.  We recommend having the latest quarterly update installed.

## Install

Running this from the command line (terminal) will download prereqs, install/update the agent bits globally and create an agent in your current directory.  Make a new directory for your agent

Copy and paste the curl line.  If your linux box does not have curl [follow this answer](http://askubuntu.com/questions/259681/the-program-curl-is-currently-not-installed)

```bash
mkdir myagent
cd my agent

curl -sSL https://raw.githubusercontent.com/Microsoft/vso-agent/master/getagent.sh | bash
```
Your output should look [similar to this](sampleoutput.md)


## Agents without Internet Access

If you have Server and Agent without internet access, it's possible to download and agent to a thumbdrive from a computer that has internet access (you need it to download :)) and then then use that to stamp out agents on your private network agent machines.

Run the Install steps above and simply copy that created folder to a thumbdrive.  From the private agent, copy that folder and then follow the steps after Install to configure the agent.

After copying the folder from the thumbdrive, ensure the logged on account has rwx permissions


