#!/bin/sh
set -ex

# This Entrypoint used when we run Docker container outside of Docker Compose (e.g. in k8s)

# In production we should replace some values in generated JS code
sed -i -f replacements.sed *.js

# We may not need to use that env vars now in nginx.config, but we may want later.
# Also we just need to copy nginx.conf to correct place anyway...
envsubst '' < /etc/nginx/conf.d/prod.conf.template > /etc/nginx/nginx.conf

exec "$@"
