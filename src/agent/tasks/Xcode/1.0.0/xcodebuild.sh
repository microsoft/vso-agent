echo xcodebuild
env

# Template Vars - queue time yes on all:
#     XcodeApp=/Applications/Xcode.app
#     Configuration=Debug, Release
#     SDK=iphonesimulator, iphoneos

# Template Matrix: On
#    Configuration, SDK

# Task Inputs: name type default
#
#  xcworkspacePath <filePath> 
#  scheme <string>
#  XcodeApp <string> $(XcodeApp)
#  Configuration <string> $(Configuration)
#  SDK <string> $(SDK)
#  Output <string> output/$(SDK)/$(Configuration)
#  

# export INPUT_XCWORKSPACEPATH=/Users/bryanmac/Projects/xcodetest/iosApp/TfsiOSSample.xcodeproj/project.xcworkspace
# export INPUT_SCHEME=CIBuild
# export INPUT_XCODEAPP=/Applications/Xcode.app
# export INPUT_SDK=iphonesimulator
# export INPUT_CONFIGURATIONNAME=Debug
# export INPUT_OUTPUTPATH=/Users/bryanmac/Projects/xcodetest/_output/

function failed()
{
    local error=${1:-Undefined error}
    echo "Failed: $error" >&2
    exit 1
}

#----------------------------------------------------------------
# Input validation and defaults
#----------------------------------------------------------------

if [ ! ${INPUT_XCWORKSPACEPATH} ]; then
    failed "xcworkspacePath must be set"
fi

if [ ! ${INPUT_SCHEME} ]; then
    failed "scheme must be set"
fi

if [ ! ${INPUT_SDK} ]; then
    failed "SDK must be set"
fi

if [ ! ${INPUT_CONFIGURATION} ]; then
    failed "Configuration must be set"
fi

if [ ! ${INPUT_XCODEAPP} ]; then
    export XCODE_APP=/Applications/Xcode.app
fi

export CWD=$(pwd)
export OUTPUT_PATH=${CWD}/output/${INPUT_SDK}/${INPUT_CONFIGURATION}
if [ ! -d ${OUTPUT_PATH} ]; then
    mkdir -p ${OUTPUT_PATH} || failed "Could not create ${OUTPUT_PATH}"
fi

# xcodebuild calls the tools set by DEVELOPER_DIR
export DEVELOPER_DIR=${INPUT_XCODEAPP}/Contents/Developer

#----------------------------------------------------------------
# Output
#----------------------------------------------------------------
echo
echo -------------------------------------------------------------
echo  XCodeBuild Settings:
echo -------------------------------------------------------------
echo "Using Xcode   : ${DEVELOPER_DIR}"
echo "Building      : ${INPUT_XCWORKSPACEPATH}"
echo "Scheme        : ${INPUT_SCHEME}"
echo "Configuration : ${INPUT_CONFIGURATION}"
echo "For SDK       : ${INPUT_SDK}"
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
xcodebuild -workspace ${INPUT_XCWORKSPACEPATH} \
           -sdk ${INPUT_SDK} \
           -scheme ${INPUT_SCHEME} \
           -configuration ${INPUT_CONFIGURATION} \
           DSTROOT=${OUTPUT_PATH}/build.dst \
           OBJROOT=${OUTPUT_PATH}/build.obj \
           SYMROOT=${OUTPUT_PATH}/build.sym \
           SHARED_PRECOMPS_DIR=${OUTPUT_PATH}/build.pch
