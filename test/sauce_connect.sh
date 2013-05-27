#!/bin/bash

# Setup and start Sauce Connect for your TravisCI build
# This script requires your .travis.yml to include the following two private env variables:
# SAUCE_USERNAME
# SAUCE_ACCESS_KEY
# Follow the steps at https://saucelabs.com/opensource/travis to set that up.

set -e

: ${SAUCE_USERNAME:?"Environment variable SAUCE_USERNAME must be set"}
: ${SAUCE_ACCESS_KEY:?"Environment variable SAUCE_ACCESS_KEY must be set"}

CONNECT_URL="http://saucelabs.com/downloads/Sauce-Connect-latest.zip"
CONNECT_DIR="/tmp/sauce-connect-$RANDOM"
CONNECT_DOWNLOAD="$CONNECT_DIR/Sauce_Connect.zip"
READY_FILE="$CONNECT_DIR/connect-ready-$RANDOM"

if [ -n "$TRAVIS" ] && [ -n "$TRAVIS_JOB_NUMBER" ]; then
    # If running on travis, use a tunnel identifier
    TUNNEL_IDENTIFIER="--tunnel-identifier $TRAVIS_JOB_NUMBER"
else
    TUNNEL_IDENTIFIER=""
fi

# Get Connect and start it
mkdir -p $CONNECT_DIR
curl -fsS -o $CONNECT_DOWNLOAD $CONNECT_URL
unzip -d $CONNECT_DIR $CONNECT_DOWNLOAD
rm $CONNECT_DOWNLOAD
java -jar $CONNECT_DIR/Sauce-Connect.jar -P 4444 -p 8124:8124 \
    --readyfile $READY_FILE \
    $TUNNEL_IDENTIFIER \
    $SAUCE_USERNAME $SAUCE_ACCESS_KEY &

# Start the web app (assume that this takes less time than Sauce Connect takes to start)
PORT=8124 node app &

# Wait for Connect to be ready before exiting
while [ ! -f $READY_FILE ]; do
    sleep .5
done
