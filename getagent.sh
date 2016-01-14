#!/usr/bin/env bash

DEFAULT_NODE_VERSION="4.2.4"
#no version is latest
DEFAULT_AGENT_VERSION=""

function failed()
{
   local error=${1:-Undefined error}
   echo "Failed: $error" >&2
   exit 1
}

agent_version=$1

if [ ! $agent_version ]; then
    agent_version=$DEFAULT_AGENT_VERSION
fi

node_version=$2

if [ ! $node_version ]; then
    node_version=$DEFAULT_NODE_VERSION
fi

echo $agent_version $node_version
#exit 0

uid=`id -u`
platform=`uname`

function checkRC() {
    local rc=$?
    if [ $rc -ne 0 ]; then
        failed "${1} Failed with return code $rc"
    fi
}

function writeHeader() {
    echo 
    echo "--- ${1} ---"
    echo
}
# ------------------------------------------------------------
# Download Node
# ------------------------------------------------------------

writeHeader "Acquiring Node $node_version"
node_file='invalid'
if [[ "$platform" == "Darwin" ]]; then
    node_file="node-v${node_version}-darwin-x64"
elif [[ "$platform" == "Linux" ]]; then
    bitness=`uname -m`
    if [[ "$bitness" == "x86_64" ]]; then
        node_file="node-v${node_version}-linux-x64"
    else
        node_file="node-v${node_version}-linux-x86"
    fi
else
    failed 'Unsupported platform: $platform'
fi

zip_file=${node_file}.tar.gz
if [ -f ${zip_file} ]; then
    echo "Download exists"
else
    node_url="https://nodejs.org/dist/v${node_version}/${zip_file}"
    echo "Downloading Node ${node_version}"
    curl -ssLO $node_url
    checkRC "Download (curl)"
fi

if [ -d ${node_file} ]; then
    echo "Already extracted"
else
    tar zxvf ./${zip_file} &> /dev/null
    checkRC "Unzip (tar)"    
fi

if [ -d "runtime" ]; then
    echo "removing existing runtime"
    rm -rf "runtime"
fi

mkdir -p "runtime/node"
cp -R ${node_file}/ "runtime/"

echo uid is $uid

writeHeader "Installing agent globally"  
echo Installing...
sudo npm install vsoagent-installer${agent_version} -g &> /dev/null
checkRC "npm install"

writeHeader "Creating agent"
vsoagent-installer
checkRC "vsoagent-installer"

writeHeader "Done"
echo Use the following scripts
echo
echo Configure:
echo ./agent/configure.sh
echo
echo Start Interactively:
echo ./agent/start.sh
echo
echo "See documentation for more commands"
echo




