# Ever Gauzy MCP AUTH

# Variables
ARG MCP_AUTH_PORT=3003
ARG MCP_AUTH_SESSION_SECRET
ARG MCP_AUTH_JWT_ISSUER
ARG MCP_AUTH_JWT_AUDIENCE
ARG REDIS_URL


FROM node:20.18.1-alpine3.19 AS dependencies

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

RUN apk add --no-cache python3 make g++ \
    && npm install yarn -g --force
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

RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts \
    && npm rebuild bcrypt better-sqlite3 --build-from-source \
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

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=60000"}
ENV NODE_ENV=production
ENV IS_DOCKER=true

RUN rm -rf /srv/gauzy-mcp-auth/dist

RUN yarn build:mcp-auth:prod

# Only prod dependencies
FROM node:20.18.1-alpine3.19 AS proddependencies

RUN apk add --no-cache python3 make g++

USER node:node

WORKDIR /srv/gauzy-mcp-auth

COPY --chown=node:node --from=build /srv/gauzy-mcp-auth/dist .
COPY --chown=node:node lerna.json package.json yarn.lock ./

RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts --production \
    && npm rebuild bcrypt better-sqlite3 --build-from-source \
    && yarn cache clean

# PROD
FROM proddependencies AS production

WORKDIR /srv/gauzy-mcp-auth

RUN yarn cache clean

# Variables
ENV MCP_AUTH_PORT=${MCP_AUTH_PORT:-3003}
ENV MCP_AUTH_SESSION_SECRET=${MCP_AUTH_SESSION_SECRET}
ENV MCP_AUTH_JWT_ISSUER=${MCP_AUTH_JWT_ISSUER}
ENV MCP_AUTH_JWT_AUDIENCE=${MCP_AUTH_JWT_AUDIENCE}
ENV REDIS_URL=${REDIS_URL}

EXPOSE ${MCP_AUTH_PORT}

CMD ["node", "apps/mcp-auth/src/main.js"]
