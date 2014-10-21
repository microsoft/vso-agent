#----------------------------------------------------------------
# Default settings for this specific script
#----------------------------------------------------------------
if [ ! ${XCWORKSPACE_PATH} ]; then
    # run from cmdline - Jenkins will set to where it's syncing code to
    SCRIPT_DIR=`dirname ${BASH_SOURCE}`
	export XCWORKSPACE_PATH=${SCRIPT_DIR}/../TfsiOSSample.xcodeproj/project.xcworkspace
fi

if [ ! ${SDK} ]; then
    # iphoneos, iphonesimulator to run latest of each
    # to see available: xcodebuild -showsdks
    SDK="iphonesimulator"
fi

if [ ! ${CONFIGURATION_NAME} ]; then
    # iphoneos, iphonesimulator to run latest of each
    # to see available: xcodebuild -showsdks
    CONFIGURATION_NAME="Debug"
fi

export SCHEME="CIBuild"
export OUTPUT_BASE_PATH="${HOME}/Build"
export FRIENDLY_NAME="TfsiOSSample"

#----------------------------------------------------------------
# Generic script below here to build a schema in a workspace
#----------------------------------------------------------------

function failed()
{
    local error=${1:-Undefined error}
    echo "Failed: $error" >&2
    exit 1
}

#----------------------------------------------------------------
# Input validation and defaults
#----------------------------------------------------------------
if [ ! -d ${OUTPUT_BASE_PATH} ]; then
    failed "OUTPUT_BASE_PATH does not exist"
fi

if [ ! ${XCWORKSPACE_PATH} ]; then
    failed "XCWORKSPACE_PATH must be set"
fi

if [ ! ${SCHEME} ]; then
    failed "SCHEME must be set"
fi

if [ ! ${SDK} ]; then
    failed "SDK must be set"
fi

if [ ! ${XCODE_APP} ]; then
    export XCODE_APP=Xcode
fi

if [ ! ${FRIENDLY_NAME} ]; then
    # default to script name if name not set
    export FRIENDLY_NAME=`basename $0`
fi

export OUTPUT_PATH=${OUTPUT_BASE_PATH}/${FRIENDLY_NAME}
if [ ! -d ${OUTPUT_PATH} ]; then
    mkdir ${OUTPUT_PATH} || failed "Could not create ${OUTPUT_PATH}"
fi

# xcodebuild calls the tools set by DEVELOPER_DIR
export DEVELOPER_DIR=/Applications/${XCODE_APP}.app/Contents/Developer

#----------------------------------------------------------------
# Output
#----------------------------------------------------------------
echo
echo -------------------------------------------------------------
echo  XCodeBuild Settings:
echo -------------------------------------------------------------
echo "Using Xcode   : ${DEVELOPER_DIR}"
echo "Building      : ${XCWORKSPACE_PATH}"
echo "Scheme        : ${SCHEME}"
echo "Configuration : ${CONFIGURATION_NAME}"
echo "For SDK       : ${SDK}"
echo "Output        : ${OUTPUT_PATH}"
echo -------------------------------------------------------------
echo

#----------------------------------------------------------------
# Run the build
#----------------------------------------------------------------
echo
echo -------------------------------------------------------------
echo  Running xcodebuild
echo -------------------------------------------------------------
echo
xcodebuild -workspace ${XCWORKSPACE_PATH} \
           -sdk ${SDK} \
           -scheme ${SCHEME} \
           -configuration ${CONFIGURATION_NAME} \
           DSTROOT=${OUTPUT_PATH}/build.dst \
           OBJROOT=${OUTPUT_PATH}/build.obj \
           SYMROOT=${OUTPUT_PATH}/build.sym \
           SHARED_PRECOMPS_DIR=${OUTPUT_PATH}/build.pch
