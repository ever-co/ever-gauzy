#!/bin/sh
set -ex

# This Entrypoint used inside Docker Compose only

export WAIT_HOSTS=$DB_HOST:$DB_PORT

# in Docker Compose we should wait other services start
./wait

# echo 'Version of PM2 …'
# pm2 --version

# echo 'Resetting PM2 Metadata …'
# pm2 reset all

# echo 'Updating PM2 …'
# pm2 update

echo 'Starting …'
exec "$@"
