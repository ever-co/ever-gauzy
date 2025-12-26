# Ever Gauzy MCP

# Transport settings
ARG MCP_TRANSPORT
ARG MCP_SERVER_MODE

# Server configuration
ARG MCP_HTTP_PORT
ARG MCP_HTTP_HOST

# Security settings
ARG MCP_CORS_ORIGIN
ARG MCP_CORS_CREDENTIALS

# AUTH
ARG MCP_AUTH_ENABLED
ARG MCP_AUTH_RESOURCE_URI
ARG MCP_AUTH_REQUIRED_SCOPES
ARG MCP_AUTH_SERVERS

# JWT
ARG MCP_AUTH_JWT_AUDIENCE
ARG MCP_AUTH_JWT_ISSUER
ARG MCP_AUTH_JWT_ALGORITHMS
ARG MCP_AUTH_JWT_JWKS_URI
ARG MCP_AUTH_JWT_PUBLIC_KEY

# Token Introspection (Alternative to JWT validation)
ARG MCP_AUTH_INTROSPECTION_ENDPOINT
ARG MCP_AUTH_INTROSPECTION_CLIENT_ID
ARG MCP_AUTH_INTROSPECTION_CLIENT_SECRET

# OAuth caching and performance
ARG MCP_AUTH_TOKEN_CACHE_TTL
ARG MCP_AUTH_METADATA_CACHE_TTL

# OAuth server options
ARG MCP_AUTH_ALLOW_EMBEDDED_SERVER
ARG MCP_AUTH_SESSION_SECRET

# Session management (stored in Redis)
ARG MCP_SESSION_ENABLED
ARG MCP_SESSION_COOKIE_NAME
ARG MCP_SESSION_TTL
ARG REDIS_ENABLED
ARG REDIS_URL
ARG REDIS_HOST
ARG REDIS_PASSWORD
ARG REDIS_PORT
ARG REDIS_USER
ARG REDIS_TLS

# Rate limiting and security
ARG THROTTLE_ENABLED
ARG THROTTLE_TTL
ARG THROTTLE_LIMIT
ARG MCP_TRUSTED_PROXIES

# Required Gauzy API settings
ARG API_BASE_URL
ARG GAUZY_AUTH_EMAIL
ARG GAUZY_AUTH_PASSWORD
ARG GAUZY_AUTO_LOGIN

# Server configuration
ARG MCP_WS_PORT
ARG MCP_WS_HOST
ARG MCP_WS_PATH

# TLS/SSL settings (recommended for production)
ARG MCP_WS_TLS
ARG MCP_WS_KEY_PATH
ARG MCP_WS_CERT_PATH

# WebSocket features
ARG MCP_WS_COMPRESSION
ARG MCP_WS_PER_MESSAGE_DEFLATE
ARG MCP_WS_MAX_PAYLOAD

# Security settings
ARG MCP_WS_ALLOWED_ORIGINS
ARG MCP_WS_SESSION_ENABLED
ARG MCP_WS_SESSION_COOKIE_NAME
ARG MCP_WS_TRUSTED_PROXIES

FROM node:24.12.0-alpine3.23 AS dependencies

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

RUN apk add --no-cache python3 python3-dev py3-pip py3-setuptools build-base gcc g++ make autoconf automake git \
    && npm install --quiet node-gyp@10.2.0 -g \
    && npm install yarn -g --force \
    && npm install --quiet ts-node@10.9.2 -g

RUN mkdir /srv/gauzy-mcp && chown -R node:node /srv/gauzy-mcp

USER node:node

WORKDIR /srv/gauzy-mcp

COPY --chown=node:node apps/mcp/package.json ./apps/mcp/
COPY --chown=node:node packages/mcp-server/package.json ./packages/mcp-server/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts \
    && yarn postinstall.manual \
    && yarn cache clean

COPY --chown=node:node apps/mcp ./apps/mcp
COPY --chown=node:node packages/mcp-server ./packages/mcp-server/
COPY --chown=node:node packages/auth ./packages/auth/
COPY --chown=node:node packages/common ./packages/common/
COPY --chown=node:node packages/config ./packages/config/
COPY --chown=node:node packages/constants ./packages/constants/
COPY --chown=node:node packages/contracts ./packages/contracts/
COPY --chown=node:node packages/utils ./packages/utils/

# BUILD
FROM dependencies AS build

WORKDIR /srv/gauzy-mcp

# Copy the node_modules from the dependencies stage
COPY --chown=node:node tsconfig.base.json tsconfig.json ./
COPY --chown=node:node nx.json lerna.json ./

ARG NODE_OPTIONS

ENV NX_NO_CLOUD=true
ENV CI=true

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=30000"}
ENV NODE_ENV=production
ENV IS_DOCKER=true

RUN rm -rf /srv/gauzy-mcp/dist

RUN yarn build:mcp:prod

# Only prod dependencies
FROM node:24.12.0-alpine3.23 AS proddependencies

RUN apk add --no-cache python3 python3-dev py3-pip py3-setuptools build-base gcc g++ make autoconf automake git \
    && npm install --quiet node-gyp@10.2.0 -g \
	&& npm install yarn -g --force \
    && npm install --quiet ts-node@10.9.2 -g

USER node:node

WORKDIR /srv/gauzy-mcp

COPY --chown=node:node --from=build /srv/gauzy-mcp/dist .
COPY --chown=node:node lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts --production \
    && yarn postinstall.manual \
    && yarn cache clean

# PROD
FROM proddependencies AS production

WORKDIR /srv/gauzy-mcp

RUN yarn cache clean

# Transport settings
ENV MCP_TRANSPORT=${MCP_TRANSPORT:-http}
ENV MCP_SERVER_MODE=${MCP_SERVER_MODE:-http}

# Server configuration
ENV MCP_HTTP_PORT=${MCP_HTTP_PORT:-3001}
ENV MCP_HTTP_HOST=${MCP_HTTP_HOST:-localhost}

# Security settings
ENV MCP_CORS_ORIGIN=${MCP_CORS_ORIGIN:-http://localhost:3000,http://localhost:4200}
ENV MCP_CORS_CREDENTIALS=${MCP_CORS_CREDENTIALS:-true}

# AUTH
ENV MCP_AUTH_ENABLED=${MCP_AUTH_ENABLED:-true}
ENV MCP_AUTH_RESOURCE_URI=${MCP_AUTH_RESOURCE_URI:-https://mcpdemo.gauzy.co}
ENV MCP_AUTH_REQUIRED_SCOPES=${MCP_AUTH_REQUIRED_SCOPES:-mcp.read,mcp.write}
ENV MCP_AUTH_SERVERS=${MCP_AUTH_SERVERS:-"[]"}

# JWT validation options
ENV MCP_AUTH_JWT_AUDIENCE=${MCP_AUTH_JWT_AUDIENCE:-https://mcp.gauzy.co}
ENV MCP_AUTH_JWT_ISSUER=${MCP_AUTH_JWT_ISSUER:-https://auth.gauzy.co}
ENV MCP_AUTH_JWT_ALGORITHMS=${MCP_AUTH_JWT_ALGORITHMS:-RS256,ES256}
ENV MCP_AUTH_JWT_JWKS_URI=${MCP_AUTH_JWT_JWKS_URI:-https://auth.gauzy.co/.well-known/jwks.json}
ENV MCP_AUTH_JWT_PUBLIC_KEY=${MCP_AUTH_JWT_PUBLIC_KEY}

# Token Introspection (Alternative to JWT validation)
ENV MCP_AUTH_INTROSPECTION_ENDPOINT=${MCP_AUTH_INTROSPECTION_ENDPOINT:-https://auth.gauzy.co/token/introspect}
ENV MCP_AUTH_INTROSPECTION_CLIENT_ID=${MCP_AUTH_INTROSPECTION_CLIENT_ID}
ENV MCP_AUTH_INTROSPECTION_CLIENT_SECRET=${MCP_AUTH_INTROSPECTION_CLIENT_SECRET}

# OAuth caching and performance
ENV MCP_AUTH_METADATA_CACHE_TTL=${MCP_AUTH_METADATA_CACHE_TTL:-3600}

# OAuth server options
ENV MCP_AUTH_ALLOW_EMBEDDED_SERVER=${MCP_AUTH_ALLOW_EMBEDDED_SERVER:-true}
ENV MCP_AUTH_SESSION_SECRET=${MCP_AUTH_SESSION_SECRET}

# Session management (stored in Redis)
ENV MCP_SESSION_ENABLED=${MCP_SESSION_ENABLED:-true}
ENV MCP_SESSION_COOKIE_NAME=${MCP_SESSION_COOKIE_NAME:-mcp-session-id}
ENV MCP_SESSION_TTL=${MCP_SESSION_TTL:-1800000}
ENV REDIS_ENABLED=${REDIS_ENABLED:-true}
ENV REDIS_URL=${REDIS_URL:-redis://localhost:6379}
ENV REDIS_HOST=${REDIS_HOST:-localhost}
ENV REDIS_PASSWORD=${REDIS_PASSWORD}
ENV REDIS_PORT=${REDIS_PORT:-6379}
ENV REDIS_USER=${REDIS_USER:-default}
ENV REDIS_TLS=${REDIS_TLS:-false}

# Rate limiting and security
ENV THROTTLE_ENABLED=${THROTTLE_ENABLED:-true}
ENV THROTTLE_TTL=${THROTTLE_TTL:-60000}
ENV THROTTLE_LIMIT=${THROTTLE_LIMIT:-100}
ENV MCP_TRUSTED_PROXIES=${MCP_TRUSTED_PROXIES:-192.168.1.1,10.0.0.1}

# Required Gauzy API settings
ENV API_BASE_URL=${API_BASE_URL:-https://apidemo.gauzy.co}
ENV GAUZY_AUTH_EMAIL=${GAUZY_AUTH_EMAIL}
ENV GAUZY_AUTH_PASSWORD=${GAUZY_AUTH_PASSWORD}
ENV GAUZY_AUTO_LOGIN=${GAUZY_AUTO_LOGIN:-true}

# Server configuration
ENV MCP_WS_PORT=${MCP_WS_PORT:-3002}
ENV MCP_WS_HOST=${MCP_WS_HOST:-localhost}
ENV MCP_WS_PATH=${MCP_WS_PATH:-/sse}

# TLS/SSL settings (recommended for production)
ENV MCP_WS_TLS=${MCP_WS_TLS:-true}
ENV MCP_WS_KEY_PATH=${MCP_WS_KEY_PATH}
ENV MCP_WS_CERT_PATH=${MCP_WS_CERT_PATH}

# WebSocket features
ENV MCP_WS_COMPRESSION=${MCP_WS_COMPRESSION:-true}
ENV MCP_WS_PER_MESSAGE_DEFLATE=${MCP_WS_PER_MESSAGE_DEFLATE:-true}
ENV MCP_WS_MAX_PAYLOAD=${MCP_WS_MAX_PAYLOAD:-16777216}

# OAuth caching and performance
ENV MCP_AUTH_TOKEN_CACHE_TTL=${MCP_AUTH_TOKEN_CACHE_TTL:-300}

# Security settings
ENV MCP_WS_ALLOWED_ORIGINS=${MCP_WS_ALLOWED_ORIGINS:-*}
ENV MCP_WS_SESSION_ENABLED=${MCP_WS_SESSION_ENABLED:-true}
ENV MCP_WS_SESSION_COOKIE_NAME=${MCP_WS_SESSION_COOKIE_NAME:-mcp-ws-session-id}
ENV MCP_WS_TRUSTED_PROXIES=${MCP_WS_TRUSTED_PROXIES:-192.168.1.1,10.0.0.1}

EXPOSE ${MCP_HTTP_PORT}
EXPOSE ${MCP_WS_PORT}

CMD ["node", "apps/mcp/src/index.js"]
