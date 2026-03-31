#!/bin/sh
set -e

# This Entrypoint used when we run Docker container outside of Docker Compose (e.g. in k8s)

echo 'Starting Worker…'
exec "$@"
