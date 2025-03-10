# Gauzy API dependencies image

ARG ENVIRONMENT=development

FROM node:20.11.1-alpine3.19 AS builder

# Set Python interpreter for `node-gyp` to use
ENV PYTHON=/usr/bin/python

RUN apk --update add bash \
    && apk add --no-cache build-base \
    && npm i -g npm@9 node-gyp@10.2.0 yarn --force \
    && mkdir /srv/gauzy \
    && chown -R node:node /srv/gauzy \
    && rm -rf /var/cache/apk/*

USER node:node
WORKDIR /srv/gauzy

# Copy related project files and configuration files
COPY --chown=node:node . .

FROM builder AS gauzy-api-deps

ARG ENVIRONMENT=development

USER node:node
WORKDIR /srv/gauzy

# Install project dependencies
RUN if [ "$ENVIRONMENT" = "production" ]; then \
    export ENV_PARAM=--production; \
    else \
    export ENV_PARAM=; \
    fi \
    && NODE_ENV=${ENVIRONMENT} yarn install \
    --network-timeout 1000000 \
    --frozen-lockfile \
    --ignore-scripts \
    --link-duplicates \
    ${ENV_PARAM} \
    && NODE_ENV=${ENVIRONMENT} yarn postinstall.manual \
    && rm -rf node_modules/@angular* \
    && rm -rf node_modules/angular* \
    && rm -rf .angular \
    && yarn cache clean
