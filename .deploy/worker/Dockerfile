# Ever Gauzy Platform Worker

ARG NODE_OPTIONS
ARG NODE_ENV
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
ARG REDIS_ENABLED
ARG REDIS_HOST
ARG REDIS_PASSWORD
ARG REDIS_PORT
ARG REDIS_USER
ARG REDIS_TLS
ARG REDIS_URL
ARG WORKER_DEFAULT_QUEUE
ARG WORKER_QUEUE_ENABLED
ARG WORKER_SCHEDULER_ENABLED
ARG WORKER_TIMEZONE
ARG SENTRY_DSN
ARG SENTRY_HTTP_TRACING_ENABLED
ARG SENTRY_POSTGRES_TRACKING_ENABLED
ARG SENTRY_PROFILING_ENABLED
ARG NX_CLOUD_ACCESS_TOKEN
ARG NX_BRANCH

FROM node:24.14.0-alpine3.23 AS base

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

ENV PYTHON /usr/bin/python

# Install system dependencies
RUN apk --update add bash dos2unix && \
    apk add --no-cache --virtual build-deps \
        bind-tools curl tar xz jq python3 python3-dev \
        py3-configobj py3-pip py3-setuptools build-base \
        snappy libheif gcc g++ snappy-dev git libgcc libstdc++ \
        linux-headers autoconf automake make nasm vips-dev vips && \
    npm i -g npm@9 node-gyp@10.2.0 && \
    npm install yarn -g --force && \
    npm install --quiet ts-node@10.9.2 -g

RUN node --version && npm --version && python3 --version && yarn --version

RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

WORKDIR /srv/gauzy

FROM base AS dependencies

ENV CI=true
ENV NODE_ENV=development

COPY wait .deploy/worker/entrypoint.prod.sh .deploy/worker/entrypoint.compose.sh /
RUN chmod +x /wait /entrypoint.compose.sh /entrypoint.prod.sh && \
    dos2unix /entrypoint.prod.sh && dos2unix /entrypoint.compose.sh

USER node:node

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/scheduler/package.json ./packages/scheduler/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

RUN --mount=type=cache,target=/home/node/.yarn/cache \
    yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts && \
    yarn postinstall.manual && yarn cache clean

FROM base AS prod_dependencies

ENV CI=true
ARG NODE_ENV

USER node:node

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/scheduler/package.json ./packages/scheduler/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

RUN --mount=type=cache,target=/home/node/.yarn/cache \
    yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts --production && \
    yarn postinstall.manual && yarn cache clean && \
    rm -rf node_modules/@angular

FROM base AS development

USER node:node

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM base AS build

RUN mkdir dist

COPY --from=dependencies /srv/gauzy/node_modules ./node_modules
COPY --chown=node:node --from=development /srv/gauzy .

ENV CI=true
ARG NODE_ENV
ARG NODE_OPTIONS
ARG NX_CLOUD_ACCESS_TOKEN
ARG NX_BRANCH

ENV NODE_OPTIONS="${NODE_OPTIONS:-"--max-old-space-size=30000"}"
ENV NODE_ENV="${NODE_ENV}"
ENV IS_DOCKER=true
ENV NX_NO_CLOUD=false
ENV NX_CLOUD_ACCESS_TOKEN="${NX_CLOUD_ACCESS_TOKEN}"
ENV NX_BRANCH="${NX_BRANCH}"

RUN yarn build:worker:prod

FROM base AS production

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh ./
COPY --chown=node:node --from=build /srv/gauzy/packages/ ./packages/
COPY --chown=node:node --from=build /srv/gauzy/dist/apps/worker .

COPY --chown=node:node --from=prod_dependencies /srv/gauzy/node_modules ./node_modules

RUN mkdir /import && touch worker.log && \
    chmod +x wait entrypoint.compose.sh entrypoint.prod.sh && \
    mkdir -p ./node_modules/@gauzy/auth && \
    mkdir -p ./node_modules/@gauzy/common && \
    mkdir -p ./node_modules/@gauzy/utils && \
    mkdir -p ./node_modules/@gauzy/config && \
    mkdir -p ./node_modules/@gauzy/contracts && \
    mkdir -p ./node_modules/@gauzy/core && \
    mkdir -p ./node_modules/@gauzy/scheduler && \
    cp -r ./packages/auth/node_modules ./node_modules/@gauzy/auth/ && \
    cp -r ./packages/common/node_modules ./node_modules/@gauzy/common/ && \
    cp -r ./packages/utils/node_modules ./node_modules/@gauzy/utils/ && \
    cp -r ./packages/config/node_modules ./node_modules/@gauzy/config/ && \
    cp -r ./packages/contracts/node_modules ./node_modules/@gauzy/contracts/ && \
    cp -r ./packages/core/node_modules ./node_modules/@gauzy/core/ && \
    cp -r ./packages/scheduler/node_modules ./node_modules/@gauzy/scheduler/ && \
    rm -rf ./packages && \
    yarn cache clean

USER node:node

ENV CI=true

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=12288"}
ENV NODE_ENV=${NODE_ENV:-production}

ENV SENTRY_HTTP_TRACING_ENABLED="${SENTRY_HTTP_TRACING_ENABLED:-false}"
ENV SENTRY_PROFILING_ENABLED="${SENTRY_PROFILING_ENABLED:-false}"
ENV SENTRY_POSTGRES_TRACKING_ENABLED="${SENTRY_POSTGRES_TRACKING_ENABLED:-false}"
ENV DB_URI="${DB_URI}"
ENV DB_HOST="${DB_HOST:-db}"
ENV DB_NAME="${DB_NAME:-postgres}"
ENV DB_PORT="${DB_PORT:-5432}"
ENV DB_USER="${DB_USER}"
ENV DB_TYPE="${DB_TYPE:-better-sqlite3}"
ENV DB_SSL_MODE="${DB_SSL_MODE}"
ENV DB_CA_CERT="${DB_CA_CERT}"
ENV DB_POOL_SIZE="${DB_POOL_SIZE}"
ENV DB_POOL_SIZE_KNEX="${DB_POOL_SIZE_KNEX}"
ENV REDIS_ENABLED="${REDIS_ENABLED:-true}"
ENV REDIS_HOST="${REDIS_HOST:-redis}"
ENV REDIS_PORT="${REDIS_PORT:-6379}"
ENV REDIS_USER="${REDIS_USER}"
ENV REDIS_TLS="${REDIS_TLS}"
ENV REDIS_URL="${REDIS_URL}"
ENV WORKER_DEFAULT_QUEUE="${WORKER_DEFAULT_QUEUE:-worker-default}"
ENV WORKER_QUEUE_ENABLED="${WORKER_QUEUE_ENABLED:-true}"
ENV WORKER_SCHEDULER_ENABLED="${WORKER_SCHEDULER_ENABLED:-true}"
ENV WORKER_TIMEZONE="${WORKER_TIMEZONE}"

ENTRYPOINT [ "./entrypoint.prod.sh" ]

CMD [ "node", "main.js" ]
