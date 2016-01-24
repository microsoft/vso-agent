# Releases

We currently offer latest and preview releases.  Preview should be functional with high qualtiy but latest is the recommended release which is patched as bugs are found.

Features are done in topic branches off of main.  With some testing, a preview release is periodically done from main.

As the preview release has been stabilized with more testing and often customer validation, a latest release is created.

## Release Branches

releases/0.x = latest
master = preview
topic branches are built and validated from source locally

## Functionality

Agent is acquires by running getagent.sh via an http://aka.ms redirect

http://aka.ms/xplatagent --> getagent.sh @ 'latest' tag in github
http://aka.ms/previewxplat --> getagent.sh @ 'master' preview in github

getagent.sh is located in github.  It is referred to via a tag, latest or preview.  So the git tag moves and the aka.ms redirect is static

getagent.sh
- Downloads correct version of agent from npm (vsoagent-installer)
- Downloads internal versions of node and tee cli 

It does this via line in getagent.sh
master: DEFAULT_AGENT_VERSION=""
releases/0.4: DEFAULT_AGENT_VERSION="@0.4"

## Create a release branch

With x.y being your new release version (currently at 0.4):

Branch from master with a name: releases/x.y
Change package.json to x.y version
Update getagent.sh:
DEFAULT_AGENT_VERSION="@x.y"

Publish the release to npm
_package/publish.sh

