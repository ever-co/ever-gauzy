#!/bin/sh
set -ex

# This Entrypoint used when we run Docker container outside of Docker Compose (e.g. in k8s)

# Use envsubst to create the actual replacements_values.sed file with values from env vars
envsubst < replacements.sed > replacements_values.sed

# In production we should replace some values in generated JS code
sed -i -f replacements_values.sed *.js

# We may not need to use that env vars now in nginx.config, but we may want later.
# Also we just need to copy nginx.conf to correct place anyway...
envsubst '' < /etc/nginx/conf.d/prod.conf.template > /etc/nginx/nginx.conf

exec "$@"
