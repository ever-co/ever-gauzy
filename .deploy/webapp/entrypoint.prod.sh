#!/bin/sh
set -ex

if [[ -z ${API_BASE_URL} ]]; then
	API_BASE_URL="http://localhost:3000"
else
	sed -i "s#http://localhost:3000#$API_BASE_URL#g" *.js
fi

export API_BASE_URL=$API_BASE_URL
exec "$@"