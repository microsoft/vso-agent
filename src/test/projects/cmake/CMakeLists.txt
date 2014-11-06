# http://www.cmake.org/cmake-tutorial

cmake_minimum_required (VERSION 2.6)
project (sqrt)

# version number
set (sqrt_VERSION_MAJOR 1)
set (sqrt_VERSION_MINOR 0)

# configure a header file to pass some of the CMake settings
# to the source code
configure_file (
	"${PROJECT_SOURCE_DIR}/sqrt.h.in"
	"${PROJECT_BINARY_DIR}/sqrt.h"
)

# add the binary tree to the search path for include files
# so that we will find TutorialConfig.h
include_directories("${PROJECT_BINARY_DIR}")

add_executable(sqrt sqrt.cxx)

