#!/bin/sh
set -ex

# This Entrypoint used inside Docker Compose only

export WAIT_HOSTS=$API_HOST:$API_PORT

# In production we should replace some values in generated JS code
sed -i "s#DOCKER_API_HOST#$API_HOST#g" *.js
sed -i "s#DOCKER_API_PORT#$API_PORT#g" *.js
sed -i "s#DOCKER_API_BASE_URL#$API_BASE_URL#g" *.js
sed -i "s#DOCKER_CLIENT_BASE_URL#$CLIENT_BASE_URL#g" *.js
sed -i "s#DOCKER_GAUZY_CLOUD_APP#$GAUZY_CLOUD_APP#g" *.js
sed -i "s#DOCKER_SENTRY_DSN#$SENTRY_DSN#g" *.js
sed -i "s#DOCKER_CHATWOOT_SDK_TOKEN#$CHATWOOT_SDK_TOKEN#g" *.js
sed -i "s#DOCKER_CHAT_MESSAGE_GOOGLE_MAP#$CHAT_MESSAGE_GOOGLE_MAP#g" *.js
sed -i "s#DOCKER_CLOUDINARY_CLOUD_NAME#$CLOUDINARY_CLOUD_NAME#g" *.js
sed -i "s#DOCKER_CLOUDINARY_API_KEY#$CLOUDINARY_API_KEY#g" *.js
sed -i "s#DOCKER_GOOGLE_MAPS_API_KEY#$GOOGLE_MAPS_API_KEY#g" *.js
sed -i "s#DOCKER_GOOGLE_PLACE_AUTOCOMPLETE#$GOOGLE_PLACE_AUTOCOMPLETE#g" *.js
sed -i "s#DOCKER_HUBSTAFF_REDIRECT_URI#$HUBSTAFF_REDIRECT_URI#g" *.js
sed -i "s#DOCKER_DEFAULT_LATITUDE#$DEFAULT_LATITUDE#g" *.js
sed -i "s#DOCKER_DEFAULT_LONGITUDE#$DEFAULT_LONGITUDE#g" *.js
sed -i "s#DOCKER_DEFAULT_CURRENCY#$DEFAULT_CURRENCY#g" *.js
sed -i "s#DOCKER_DEFAULT_COUNTRY#$DEFAULT_COUNTRY#g" *.js
sed -i "s#DOCKER_DEMO#$DEMO#g" *.js
sed -i "s#DOCKER_WEB_HOST#$WEB_HOST#g" *.js
sed -i "s#DOCKER_WEB_PORT#$WEB_PORT#g" *.js

envsubst '${API_HOST} ${API_PORT}' < /etc/nginx/conf.d/compose.conf.template > /etc/nginx/nginx.conf

# In Docker Compose we should wait other services start
./wait

exec "$@"
