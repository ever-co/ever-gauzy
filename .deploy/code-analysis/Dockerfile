# Gauzy image to run code analysis

ARG DEPENDENCIES_IMAGE

FROM ${DEPENDENCIES_IMAGE:-"no-image"} AS builder

# Set Python interpreter for `node-gyp` to use
ENV CI=true \
    PYTHON=/usr/bin/python

USER node:node
WORKDIR /srv/gauzy

# Copy related project files and configuration files
COPY --chown=node:node . .
