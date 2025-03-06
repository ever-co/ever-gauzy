# Ever Gauzy Platform API (Core)

FROM node:20.11.1-alpine3.19 AS gauzy-deps

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

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

# Install project production dependencies
RUN NODE_ENV=production yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts --production \
    && NODE_ENV=production yarn postinstall.manual \
    && rm -rf node_modules/@angular \
    && cp -r ./node_modules ./node_modules_prod \
    # Install project development dependencies
    && NODE_ENV=development yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts \
    && NODE_ENV=development yarn postinstall.manual \
    && yarn cache clean
