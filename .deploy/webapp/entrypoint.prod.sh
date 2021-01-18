#!/bin/sh
set -ex

# This Entrypoint used when we run Docker container outside of Docker Compose (e.g. in k8s)

# In production we should replace API URL in generated JS code
if [[ -z ${API_BASE_URL} ]]; then
	API_BASE_URL="http://localhost:3000"
else
	sed -i "s#http://localhost:3000#$API_BASE_URL#g" *.js
fi

# We may not need to use that env vars now in nginx.config, but we may want later. 
# Also we just need to copy nginx.conf to correct place anyway...
envsubst '' < /etc/nginx/conf.d/prod.conf.template > /etc/nginx/nginx.conf

exec "$@"