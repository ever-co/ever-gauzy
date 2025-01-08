#!/bin/sh
set -ex

# This Entrypoint used inside Docker Compose only

export WAIT_HOSTS=$DB_HOST:$DB_PORT

# in Docker Compose we should wait other services start
./wait

echo 'Starting …'
exec "$@"
