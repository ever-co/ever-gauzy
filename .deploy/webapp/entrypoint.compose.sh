#!/bin/sh
set -ex

# This Entrypoint used inside Docker Compose only

export WAIT_HOSTS=$API_HOST:$API_PORT

# In production we should replace some values in generated JS code
sed -i -f replacements.sed *.js

# We need to copy nginx.conf to correct place
envsubst '${API_HOST} ${API_PORT}' < /etc/nginx/conf.d/compose.conf.template > /etc/nginx/nginx.conf

# In Docker Compose we should wait other services start
./wait

exec "$@"
