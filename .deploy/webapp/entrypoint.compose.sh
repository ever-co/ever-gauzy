#!/bin/sh
set -ex

# This Entrypoint used inside Docker Compose only

export PORT=${PORT:-4200}
export HOST=${HOST:-0.0.0.0}
export API_HOST=${API_HOST:-api}
export API_PORT=${API_PORT:-3000}
export WAIT_HOSTS=$API_HOST:$API_PORT
export API_BASE_URL=$API_BASE_URL

envsubst '${API_HOST} ${API_PORT} ${API_BASE_URL}' < /etc/nginx/conf.d/compose.conf.template > /etc/nginx/nginx.conf

# in Docker Compose we should wait other services start
./wait

exec "$@"
