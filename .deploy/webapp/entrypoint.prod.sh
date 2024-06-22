#!/bin/sh
set -ex

# This Entrypoint used when we run Docker container outside of Docker Compose (e.g. in k8s)

# In production we should replace some values in generated JS code
sed -i "s#DOCKER_API_HOST#$API_HOST#g" *.js
sed -i "s#DOCKER_API_PORT#$API_PORT#g" *.js
sed -i "s#DOCKER_API_BASE_URL#$API_BASE_URL#g" *.js
sed -i "s#DOCKER_CLIENT_BASE_URL#$CLIENT_BASE_URL#g" *.js
sed -i "s#DOCKER_I4NET_CLOUD_APP#$I4NET_CLOUD_APP#g" *.js
sed -i "s#DOCKER_SENTRY_DSN#$SENTRY_DSN#g" *.js
sed -i "s#DOCKER_SENTRY_TRACES_SAMPLE_RATE#$SENTRY_TRACES_SAMPLE_RATE#g" *.js
sed -i "s#DOCKER_CHATWOOT_SDK_TOKEN#$CHATWOOT_SDK_TOKEN#g" *.js
sed -i "s#DOCKER_CHAT_MESSAGE_GOOGLE_MAP#$CHAT_MESSAGE_GOOGLE_MAP#g" *.js
sed -i "s#DOCKER_CLOUDINARY_CLOUD_NAME#$CLOUDINARY_CLOUD_NAME#g" *.js
sed -i "s#DOCKER_CLOUDINARY_API_KEY#$CLOUDINARY_API_KEY#g" *.js
sed -i "s#DOCKER_GOOGLE_MAPS_API_KEY#$GOOGLE_MAPS_API_KEY#g" *.js
sed -i "s#DOCKER_GOOGLE_PLACE_AUTOCOMPLETE#$GOOGLE_PLACE_AUTOCOMPLETE#g" *.js
sed -i "s#DOCKER_HUBSTAFF_REDIRECT_URL#$HUBSTAFF_REDIRECT_URL#g" *.js
sed -i "s#DOCKER_DEFAULT_LATITUDE#$DEFAULT_LATITUDE#g" *.js
sed -i "s#DOCKER_DEFAULT_LONGITUDE#$DEFAULT_LONGITUDE#g" *.js
sed -i "s#DOCKER_DEFAULT_CURRENCY#$DEFAULT_CURRENCY#g" *.js
sed -i "s#DOCKER_DEFAULT_COUNTRY#$DEFAULT_COUNTRY#g" *.js
sed -i "s#DOCKER_DEMO#$DEMO#g" *.js
sed -i "s#DOCKER_WEB_HOST#$WEB_HOST#g" *.js
sed -i "s#DOCKER_WEB_PORT#$WEB_PORT#g" *.js
sed -i "s#DOCKER_I4NET_GITHUB_CLIENT_ID#$I4NET_GITHUB_CLIENT_ID#g" *.js
sed -i "s#DOCKER_I4NET_GITHUB_APP_NAME#$I4NET_GITHUB_APP_NAME#g" *.js
sed -i "s#DOCKER_I4NET_GITHUB_REDIRECT_URL#$I4NET_GITHUB_REDIRECT_URL#g" *.js
sed -i "s#DOCKER_I4NET_GITHUB_APP_ID#$I4NET_GITHUB_APP_ID#g" *.js
sed -i "s|DOCKER_I4NET_GITHUB_POST_INSTALL_URL|$I4NET_GITHUB_POST_INSTALL_URL|g" *.js
sed -i "s#DOCKER_JITSU_BROWSER_URL#$JITSU_BROWSER_URL#g" *.js
sed -i "s#DOCKER_JITSU_BROWSER_WRITE_KEY#$JITSU_BROWSER_WRITE_KEY#g" *.js

# We may not need to use that env vars now in nginx.config, but we may want later.
# Also we just need to copy nginx.conf to correct place anyway...
envsubst '' < /etc/nginx/conf.d/prod.conf.template > /etc/nginx/nginx.conf

exec "$@"
