#!/bin/sh
set -ex

# This Entrypoint used inside Docker Compose only

export host=${host-0.0.0.0}
export port=${API_PORT:-3000}
export DB_HOST=${DB_HOST:-db}
export WAIT_HOSTS=$DB_HOST:$DB_PORT

# in Docker Compose we should wait other services start
./wait

exec "$@"
