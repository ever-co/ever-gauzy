#!/bin/sh
set -ex

# This Entrypoint used when we run Docker container outside of Docker Compose (e.g. in k8s)

# echo 'Version of PM2 …'
# pm2 --version

# echo 'Resetting PM2 Metadata …'
# pm2 reset all

# echo 'Updating PM2 …'
# pm2 update

echo 'Starting …'
exec "$@"
