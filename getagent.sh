#!/usr/bin/env bash

# TODO:
# node handler uses private copy
# doc separate scenarios

# run to install
# curl -sSL https://raw.githubusercontent.com/Microsoft/vso-agent/master/getagent.sh | sh

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
    echo "********** ${1} **********"
    echo
}

# ------------------------------------------------------------
# Install Agent
# ------------------------------------------------------------

writeHeader "Installing agent globally"  
echo Installing...
install_name=vsoagent-installer${agent_version}

# support installing locally built agent
# run script through curl and piping to sh will have dir of .
# if you run from locally built 
script_dir=$(dirname $0)
echo script location: ${script_dir}
if [ ${script_dir} != "." ] && [ ${script_dir} ]; then
    echo Dev Install.  Using location ${script_dir}
    install_name=${script_dir}
fi

sudo npm install ${install_name} -g &> /dev/null
checkRC "npm install"

writeHeader "Creating agent"
vsoagent-installer
checkRC "vsoagent-installer"

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

writeHeader "Configuration Options:"
echo
echo Run Interactively:
echo ./run.sh
echo
echo Configure Again:
echo ./configure.sh
echo
echo "See documentation for more options"
echo

writeHeader "Configurating and Running Agent"
echo
echo ctrl-c to stop ...
echo
./runtime/bin/node agent/vsoagent.js

