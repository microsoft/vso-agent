export ACTION="$1"
export OPTION="$2"
BASEDIR=$(dirname $0)

function failed()
{
   local error=${1:-Undefined error}
   echo "Failed: $error" >&2
   exit 1
}

function installsvc() {
	export RUNAS=${USER}

	sudo node ${BASEDIR}/service.js install ${RUNAS} ${OPTION}
}

function svcAction() { 
	sudo node ${BASEDIR}/service.js $1 
}

if [ "${ACTION}" == "install" ]; then
	installsvc	 		
else
	svcAction ${ACTION}
fi
