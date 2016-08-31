#!/bin/bash

# Change to test directory.
cd "${0%/*}"

# Variables
BUILDER="${PWD}/../../bin/builder.js"

echo -e "\nTEST: Basic config overrides"
OUT=$(node ${BUILDER} run echo);
if [[ $OUT != *"ECHO MSG: hi"*  ]]; then echo -e "\n\n=== FAILED OUTPUT ===\n${OUT}\n\n"; exit 1; fi

echo -e "\nTEST: Silence log"
OUT=$(node ${BUILDER} run echo --log-level=none)
if [[ $OUT == *"builder-core:start"*  ]]; then echo -e "\n\n=== FAILED OUTPUT ===\n${OUT}\n\n"; exit 1; fi

echo -e "\nTEST: Env overrides config"
OUT=$(npm_package_config_msg="over" node ${BUILDER} run echo)
if [[ $OUT != *"ECHO MSG: over"*  ]]; then echo -e "\n\n=== FAILED OUTPUT ===\n${OUT}\n\n"; exit 1; fi
