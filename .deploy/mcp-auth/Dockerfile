# Ever Gauzy MCP AUTH

# Variables
ARG MCP_AUTH_PORT=3003
ARG MCP_AUTH_BASE_URL
ARG MCP_AUTH_SESSION_SECRET
ARG MCP_AUTH_JWT_ISSUER
ARG MCP_AUTH_JWT_AUDIENCE
ARG REDIS_ENABLED
ARG REDIS_URL
ARG REDIS_HOST
ARG REDIS_PASSWORD
ARG REDIS_PORT
ARG REDIS_USER
ARG REDIS_TLS

# Database Configuration (same as Gauzy API)
ARG DB_URI
ARG DB_HOST
ARG DB_NAME
ARG DB_PORT
ARG DB_USER
ARG DB_PASS
ARG DB_TYPE
ARG DB_SSL_MODE
ARG DB_CA_CERT
ARG DB_POOL_SIZE
ARG DB_POOL_SIZE_KNEX
ARG DB_CONNECTION_TIMEOUT
ARG DB_IDLE_TIMEOUT
ARG DB_SLOW_QUERY_LOGGING_TIMEOUT
ARG DB_LOGGING
ARG DB_ORM
ARG DB_SYNCHRONIZE

# Proxy Configuration
ARG MCP_TRUSTED_PROXIES


FROM node:24.12.0-alpine3.23 AS dependencies

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

RUN apk add --no-cache python3 python3-dev py3-pip py3-setuptools build-base gcc g++ make autoconf automake git \
    && npm install --quiet node-gyp@10.2.0 -g \
    && npm install yarn -g --force \
    && npm install --quiet ts-node@10.9.2 -g

RUN mkdir /srv/gauzy-mcp-auth && chown -R node:node /srv/gauzy-mcp-auth

USER node:node

WORKDIR /srv/gauzy-mcp-auth

COPY --chown=node:node apps/mcp-auth/package.json ./apps/mcp-auth/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts \
    && yarn postinstall.manual \
    && yarn cache clean

COPY --chown=node:node apps/mcp-auth ./apps/mcp-auth
COPY --chown=node:node packages/auth ./packages/auth/
COPY --chown=node:node packages/common ./packages/common/
COPY --chown=node:node packages/config ./packages/config/
COPY --chown=node:node packages/constants ./packages/constants/
COPY --chown=node:node packages/contracts ./packages/contracts/
COPY --chown=node:node packages/core ./packages/core/
COPY --chown=node:node packages/plugin ./packages/plugin/
COPY --chown=node:node packages/utils ./packages/utils/

# BUILD
FROM dependencies AS build

WORKDIR /srv/gauzy-mcp-auth

# Copy the node_modules from the dependencies stage
COPY --chown=node:node tsconfig.base.json tsconfig.json ./
COPY --chown=node:node nx.json lerna.json ./

ARG NODE_OPTIONS

ENV NX_NO_CLOUD=true
ENV CI=true

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=30000"}
ENV NODE_ENV=production
ENV IS_DOCKER=true

RUN rm -rf /srv/gauzy-mcp-auth/dist

RUN yarn build:mcp-auth:prod

# Only prod dependencies
FROM node:24.12.0-alpine3.23 AS proddependencies

RUN apk add --no-cache python3 python3-dev py3-pip py3-setuptools build-base gcc g++ make autoconf automake git \
    && npm install --quiet node-gyp@10.2.0 -g \
	&& npm install yarn -g --force \
    && npm install --quiet ts-node@10.9.2 -g

USER node:node

WORKDIR /srv/gauzy-mcp-auth

COPY --chown=node:node --from=build /srv/gauzy-mcp-auth/dist .
COPY --chown=node:node lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts --production \
    && yarn postinstall.manual \
    && yarn cache clean

# PROD
FROM proddependencies AS production

WORKDIR /srv/gauzy-mcp-auth

RUN yarn cache clean

# Variables
ENV MCP_AUTH_PORT=${MCP_AUTH_PORT:-3003}
ENV MCP_AUTH_BASE_URL=${MCP_AUTH_BASE_URL}
ENV MCP_AUTH_SESSION_SECRET=${MCP_AUTH_SESSION_SECRET}
ENV MCP_AUTH_JWT_ISSUER=${MCP_AUTH_JWT_ISSUER}
ENV MCP_AUTH_JWT_AUDIENCE=${MCP_AUTH_JWT_AUDIENCE}

# Redis Configuration
ENV REDIS_ENABLED=${REDIS_ENABLED}
ENV REDIS_URL=${REDIS_URL}
ENV REDIS_HOST=${REDIS_HOST}
ENV REDIS_PASSWORD=${REDIS_PASSWORD}
ENV REDIS_PORT=${REDIS_PORT}
ENV REDIS_USER=${REDIS_USER}
ENV REDIS_TLS=${REDIS_TLS:-false}

# Database Configuration (same as Gauzy API)
ENV DB_URI=${DB_URI}
ENV DB_HOST=${DB_HOST:-db}
ENV DB_NAME=${DB_NAME:-postgres}
ENV DB_PORT=${DB_PORT:-5432}
ENV DB_USER=${DB_USER}
ENV DB_PASS=${DB_PASS}
ENV DB_TYPE=${DB_TYPE:-better-sqlite3}
ENV DB_SSL_MODE=${DB_SSL_MODE}
ENV DB_CA_CERT=${DB_CA_CERT}
ENV DB_POOL_SIZE=${DB_POOL_SIZE}
ENV DB_POOL_SIZE_KNEX=${DB_POOL_SIZE_KNEX}
ENV DB_CONNECTION_TIMEOUT=${DB_CONNECTION_TIMEOUT}
ENV DB_IDLE_TIMEOUT=${DB_IDLE_TIMEOUT}
ENV DB_SLOW_QUERY_LOGGING_TIMEOUT=${DB_SLOW_QUERY_LOGGING_TIMEOUT}
ENV DB_LOGGING=${DB_LOGGING}
ENV DB_ORM=${DB_ORM:-typeorm}
ENV DB_SYNCHRONIZE=${DB_SYNCHRONIZE:-false}

# Proxy Configuration
ENV MCP_TRUSTED_PROXIES=${MCP_TRUSTED_PROXIES}

EXPOSE ${MCP_AUTH_PORT}

CMD ["node", "apps/mcp-auth/src/main.js"]
