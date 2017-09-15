#!/usr/bin/env bash

# TODO:
# node handler uses private copy
# doc separate scenarios

# run to install
# curl -sSL https://raw.githubusercontent.com/Microsoft/vso-agent/master/getagent.sh | bash

echo Deprecated
return 1

DEFAULT_NODE_VERSION="5.6.0"
DEFAULT_TEE_VERSION="14.0.2-private"

# overrides so you can create an offline install for Linux from an OSX machine, etc...
# export platform_override=Darwin
# export platform_override=Linux
# export bit_override=x86
# export bit_override=x86_64

#no version is latest
DEFAULT_AGENT_VERSION=""

function failed()
{
   local error=${1:-Undefined error}
   echo "Failed: $error" >&2
   exit 1
}

uid=`id -u`
platform=${platform_override:-`uname`}
echo "Platform: $platform"
if [ $uid -eq 0 ]; then
    failed "Install cannot be run as root.  Do not use sudo"
fi

agent_version=${GET_AGENT_VERSION}

if [ ! $agent_version ]; then
    agent_version=$DEFAULT_AGENT_VERSION
fi

node_version=${GET_NODE_VERSION}

if [ ! $node_version ]; then
    node_version=$DEFAULT_NODE_VERSION
fi

tee_version=${GET_TEE_VERSION}

if [ ! $tee_version ]; then
    tee_version=$DEFAULT_TEE_VERSION
fi


function checkRC() {
    local rc=$?
    if [ $rc -ne 0 ]; then
        failed "${1} Failed with return code $rc"
    fi
}

function warnRC() {
    local rc=$?
    if [ $rc -ne 0 ]; then
        failed "WARNING: ${1} Failed with return code $rc.  ${2}"
    fi
}

function writeHeader() {
    echo 
    echo --------------------------------------
    echo "     ${1} "
    echo --------------------------------------
    echo
}

# password early in script
mkdir -p _install

if [ -d "runtime" ]; then
    echo "removing existing runtime"
    rm -rf "runtime"
fi

# ------------------------------------------------------------
# Download Node
# ------------------------------------------------------------

writeHeader "Acquiring Node $node_version"
node_file='invalid'
if [[ "$platform" == "Darwin" ]]; then
    node_file="node-v${node_version}-darwin-x64"
elif [[ "$platform" == "Linux" ]]; then
    bitness=${bit_override:-`uname -m`}
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
    echo "Downloading Node ${node_version} @ ${node_url}"
    curl -skSLO $node_url &> _install/downloadnode.log
    checkRC "Download (curl)"
fi

if [ -d ${node_file} ]; then
    echo "Already extracted"
else
    tar zxvf ./${zip_file} &> _install/targznode.log
    checkRC "Unzip (node)"
fi

mkdir -p runtime/node
cp -R ${node_file}/. runtime/node

# ensure we use private node and npm for rest of script

if  [[ -z "$platform_override" ]]; then
    # if we're overriding the platform to create another platforms install, then use global npm
    echo 'Setting internal node in path'
    PATH=`pwd`/runtime/node/bin:$PATH
fi

echo "using node : `which node`"
echo "using npm  : `which npm`"

# ------------------------------------------------------------
# Download TEE CLI
# ------------------------------------------------------------
writeHeader "Acquiring TEE CLI $tee_version"
tee_file=TEE-CLC-${tee_version}
tee_zip=${tee_file}.zip

if [ -f ${tee_zip} ]; then
    echo "Download exists"
else
    echo "Downloading  TEE CLI ${tee_version}"
    curl -skSLO http://aka.ms/${tee_zip} &> _install/downloadtee.log
    warnRC "Download (TEE CLI)" "This is only critical if using TFSVC (not needed for git)"
fi

if [ -d ${tee_file} ]; then
    echo "Already extracted"
else
    unzip ./${tee_zip} &> _install/unziptee.log
    warnRC "Unzip (tee)" "This is only critical if using TFSVC (not needed for git)"
fi

mkdir -p runtime/tee
cp -R ${tee_file}/. runtime/tee

tf_path=`pwd`/runtime/tee/tf
if [ -f "`which java`" ]; then
   echo "Accepting Eula (${tf_path})"
   `${tf_path} eula -accept`
else
   echo "Java not found in your path.  If you use tfsvc + tee, before use run:"
   echo "${tf_path} eula -accept"
fi

# ------------------------------------------------------------
# Install Agent
# ------------------------------------------------------------

writeHeader "Installing agent installer"
echo "Cleaning up existing agent"

if [ -f "package.json" ]; then
    rm package.json
    rm *.sh
fi

rm -rf agent
rm -rf node_modules
rm -rf _installer
mkdir -p _installer/node_modules
pushd _installer

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

echo installing ${install_name} ...
npm install ${install_name} &> ../_install/npminstall.log
checkRC "npm install"

writeHeader "Creating agent"
popd
cp -R _installer/node_modules/vsoagent-installer/agent .
cp -R _installer/node_modules/vsoagent-installer/*.sh .
cp _installer/node_modules/vsoagent-installer/package.json .
cp -R _installer/node_modules .
rm -rf node_modules/vsoagent-installer

chmod 777 *.sh
# rm -rf _installer

# logging info for troubleshooting
find . > _install/layout.log
ls -la > _install/ls.log
cat package.json | grep "\"version" > _install/version.log

writeHeader "Agent Installed! Next Steps:"
echo Run and Configure Interactively:
echo ./run.sh
echo
echo Configure Again:
echo ./configure.sh
echo
echo "See documentation for more options"
echo

