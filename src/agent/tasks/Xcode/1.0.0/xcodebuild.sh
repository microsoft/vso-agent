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
if [ ! -d ${INPUT_OUTPUTPATH} ]; then
    failed "OUTPUTPATH does not exist"
fi

if [ ! ${INPUT_XCWORKSPACEPATH} ]; then
    failed "XCWORKSPACEPATH must be set"
fi

if [ ! ${INPUT_SCHEME} ]; then
    failed "SCHEME must be set"
fi

if [ ! ${INPUT_SDK} ]; then
    failed "SDK must be set"
fi

if [ ! ${INPUT_XCODEAPP} ]; then
    export XCODE_APP=/Applications/Xcode.app
fi

if [ ! -d ${INPUT_OUTPUTPATH} ]; then
    mkdir ${INPUT_OUTPUTPATH} || failed "Could not create ${OUTPUTPATH}"
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
echo "Configuration : ${INPUT_CONFIGURATIONNAME}"
echo "For SDK       : ${INPUT_SDK}"
echo "Output        : ${INPUT_OUTPUTPATH}"
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
           -configuration ${INPUT_CONFIGURATIONNAME} \
           DSTROOT=${INPUT_OUTPUTPATH}/build.dst \
           OBJROOT=${INPUT_OUTPUTPATH}/build.obj \
           SYMROOT=${INPUT_OUTPUTPATH}/build.sym \
           SHARED_PRECOMPS_DIR=${INPUT_OUTPUTPATH}/build.pch
