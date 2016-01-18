#!/usr/bin/env bash

if [ -f ".agent" ]; then
    echo "Removing current configuration ..."
    rm .agent
fi

./runtime/node/bin/node agent/vsoagent.js nostart
