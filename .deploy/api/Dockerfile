# DSpot ERP Platform API (Core)

ARG DEPENDENCIES_IMAGE
ARG GIT_HASH
ARG NODE_OPTIONS
ARG NODE_ENV
ARG API_BASE_URL
ARG CLIENT_BASE_URL
ARG API_HOST
ARG API_PORT
ARG CLOUD_PROVIDER
ARG SENTRY_DSN
ARG SENTRY_HTTP_TRACING_ENABLED
ARG SENTRY_POSTGRES_TRACKING_ENABLED
ARG SENTRY_PROFILING_ENABLED
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
ARG DEMO
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_REGION
ARG AWS_S3_BUCKET
ARG WASABI_ACCESS_KEY_ID
ARG WASABI_SECRET_ACCESS_KEY
ARG WASABI_REGION
ARG WASABI_SERVICE_URL
ARG WASABI_S3_BUCKET
ARG WASABI_S3_FORCE_PATH_STYLE
ARG DIGITALOCEAN_ACCESS_KEY_ID
ARG DIGITALOCEAN_SECRET_ACCESS_KEY
ARG DIGITALOCEAN_REGION
ARG DIGITALOCEAN_SERVICE_URL
ARG DIGITALOCEAN_CDN_URL
ARG DIGITALOCEAN_S3_BUCKET
ARG DIGITALOCEAN_S3_FORCE_PATH_STYLE
ARG EXPRESS_SESSION_SECRET
ARG JWT_SECRET
ARG JWT_REFRESH_TOKEN_SECRET
ARG REFRESH_TOKEN_EXPIRATION_TIME
ARG MAIL_FROM_ADDRESS
ARG MAIL_HOST
ARG MAIL_PORT
ARG MAIL_USERNAME
ARG MAIL_PASSWORD
ARG ALLOW_SUPER_ADMIN_ROLE
ARG GOOGLE_CLIENT_ID
ARG GOOGLE_CLIENT_SECRET
ARG GOOGLE_CALLBACK_URL
ARG FACEBOOK_CLIENT_ID
ARG FACEBOOK_CLIENT_SECRET
ARG FACEBOOK_GRAPH_VERSION
ARG FACEBOOK_CALLBACK_URL
ARG INTEGRATED_USER_DEFAULT_PASS
ARG UPWORK_REDIRECT_URL
ARG HUBSTAFF_CLIENT_ID
ARG HUBSTAFF_CLIENT_SECRET
ARG HUBSTAFF_PERSONAL_ACCESS_TOKEN
ARG FILE_PROVIDER
ARG GAUZY_AI_GRAPHQL_ENDPOINT
ARG GAUZY_AI_REST_ENDPOINT
ARG DEFAULT_CURRENCY
ARG CLOUDINARY_CLOUD_NAME
ARG CLOUDINARY_API_KEY
ARG UNLEASH_APP_NAME
ARG UNLEASH_API_URL
ARG UNLEASH_INSTANCE_ID
ARG UNLEASH_REFRESH_INTERVAL
ARG UNLEASH_METRICS_INTERVAL
ARG UNLEASH_API_KEY
ARG JITSU_SERVER_URL
ARG JITSU_SERVER_WRITE_KEY
ARG GAUZY_GITHUB_CLIENT_ID
ARG GAUZY_GITHUB_CLIENT_SECRET
ARG GAUZY_GITHUB_WEBHOOK_URL
ARG GAUZY_GITHUB_WEBHOOK_SECRET
ARG GAUZY_GITHUB_APP_ID
ARG GAUZY_GITHUB_APP_NAME
ARG GAUZY_GITHUB_POST_INSTALL_URL
ARG GAUZY_GITHUB_APP_PRIVATE_KEY
ARG MAGIC_CODE_EXPIRATION_TIME
ARG APP_NAME
ARG APP_SIGNATURE
ARG APP_LINK
ARG APP_EMAIL_CONFIRMATION_URL
ARG APP_MAGIC_SIGN_URL
ARG COMPANY_LINK
ARG COMPANY_NAME
ARG OTEL_ENABLED
ARG OTEL_PROVIDER
ARG OTEL_EXPORTER_OTLP_HEADERS
ARG OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
ARG REDIS_ENABLED
ARG REDIS_URL
ARG DB_ORM
ARG MIKRO_ORM_ALLOW_GLOBAL_CONTEXT


FROM ${DEPENDENCIES_IMAGE:-"no-image"}:latest-api-dev AS builder

LABEL maintainer="info@dspot.com.pl"
LABEL org.opencontainers.image.source="https://github.com/DSpotDevelopers/gauzy"

<<<<<<< HEAD
=======
# We need to set to "development", because we are using "yarn install" below to setup
# devDependencies even for production builds!
ENV NODE_ENV=development

# Set Python interpreter for `node-gyp` to use
ENV PYTHON /usr/bin/python

RUN apk --update add bash && npm i -g npm@9 \
	&& apk add --no-cache --virtual build-dependencies bind-tools curl tar xz jq python3 python3-dev py3-configobj py3-pip py3-setuptools build-base \
	snappy libheif dos2unix gcc g++ snappy-dev git libgcc libstdc++ linux-headers autoconf automake make nasm vips-dev vips

# Verify installed versions
RUN node --version && npm --version && python3 --version

RUN npm install --quiet node-gyp@10.2.0 -g && npm install yarn -g --force
RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/api/entrypoint.prod.sh .deploy/api/entrypoint.compose.sh /
RUN chmod +x /wait /entrypoint.compose.sh /entrypoint.prod.sh && dos2unix /entrypoint.prod.sh && dos2unix /entrypoint.compose.sh

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/api/package.json ./apps/api/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/integration-github/package.json ./packages/plugins/integration-github/
COPY --chown=node:node packages/plugins/integration-jira/package.json ./packages/plugins/integration-jira/
COPY --chown=node:node packages/plugins/jitsu-analytics/package.json ./packages/plugins/jitsu-analytics/
COPY --chown=node:node packages/plugins/sentry-tracing/package.json ./packages/plugins/sentry-tracing/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/videos/package.json ./packages/plugins/videos/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/
COPY --chown=node:node packages/plugins/job-search/package.json ./packages/plugins/job-search/
COPY --chown=node:node packages/plugins/job-proposal/package.json ./packages/plugins/job-proposal/

# We do not build Wakatime plugin here, because it is used in Desktop Apps for now
# COPY --chown=node:node packages/plugins/integration-wakatime/package.json ./packages/plugins/integration-wakatime/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.ts ./.scripts/

RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts && yarn postinstall.manual && yarn cache clean

FROM node:20.11.1-alpine3.19 AS prodDependencies

ENV CI=true

# We make NODE_ENV passed as build argument to be available in this stage
ARG NODE_ENV

# Set Python interpreter for `node-gyp` to use
ENV PYTHON /usr/bin/python

RUN apk --update add bash && npm i -g npm@9 \
	&& apk add --no-cache --virtual build-dependencies bind-tools curl tar xz jq python3 python3-dev py3-configobj py3-pip py3-setuptools build-base \
	snappy libheif dos2unix gcc g++ snappy-dev git libgcc libstdc++ linux-headers autoconf automake make nasm vips-dev vips

# Verify installed versions
RUN node --version && npm --version && python3 --version

RUN npm install --quiet node-gyp@10.2.0 -g && npm install yarn -g --force
RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/api/package.json ./apps/api/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/integration-github/package.json ./packages/plugins/integration-github/
COPY --chown=node:node packages/plugins/integration-jira/package.json ./packages/plugins/integration-jira/
COPY --chown=node:node packages/plugins/jitsu-analytics/package.json ./packages/plugins/jitsu-analytics/
COPY --chown=node:node packages/plugins/sentry-tracing/package.json ./packages/plugins/sentry-tracing/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/videos/package.json ./packages/plugins/videos/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/
COPY --chown=node:node packages/plugins/job-search/package.json ./packages/plugins/job-search/
COPY --chown=node:node packages/plugins/job-proposal/package.json ./packages/plugins/job-proposal/

# We do not build here Wakatime plugin, because it used in Desktop Apps for now
# COPY --chown=node:node packages/plugins/integration-wakatime/package.json ./packages/plugins/integration-wakatime/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.ts ./.scripts/

RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts --production && yarn postinstall.manual && yarn cache clean

# We remove Angular modules as it's not used in APIs
RUN rm -r node_modules/@angular

# Exclude @gauzy directories before copying because we copy
# those within custom webpack in apps/api/config/custom-webpack.config.js
# RUN rm -r node_modules/@gauzy

FROM node:20.11.1-alpine3.19 AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:20.11.1-alpine3.19 AS build

WORKDIR /srv/gauzy

RUN mkdir dist

# Copy the node_modules from the dependencies stage
COPY --from=dependencies /srv/gauzy/node_modules ./node_modules

# Copy the compiled packages from the development stage
COPY --chown=node:node --from=development /srv/gauzy .

ENV CI=true

# We make NODE_ENV and other env vars passed as build argument to be available in this stage
>>>>>>> f02fd16b77 (fix(constants): docker build for @gauzy/constants)
ARG NODE_ENV
ARG DEMO
ARG NODE_OPTIONS

WORKDIR /srv/gauzy

# Copy related project files and configuration files
COPY --chown=node:node . .

# Set the environment variables
ENV CI=true \
	NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=60000"} \
	NODE_ENV=${NODE_ENV:-"development"} \
	DEMO=${DEMO:-false} \
	IS_DOCKER=true \
	NX_NO_CLOUD=true

# Build the API service for production and install production dependencies
RUN yarn build:api:prod:docker

FROM ${DEPENDENCIES_IMAGE:-"no-image"}:latest-api-prod AS production

ARG GIT_HASH
WORKDIR /srv/gauzy

# Copy the built API items and prepare dependencies
COPY --chown=node:node --from=builder /srv/gauzy/dist/apps/api/assets /srv/gauzy/dist/apps/api/public /srv/gauzy/dist/apps/api/main.* ./
COPY --chown=node:node --from=builder /srv/gauzy/dist/packages/ /srv/gauzy/dist/packages/
COPY --chown=node:node --from=builder /srv/gauzy/packages/ /srv/gauzy/packages/

# Fix @guazy dependencies
RUN rm -rf ./node_modules/@gauzy \
	&& mkdir -p ./node_modules/@gauzy \
	&& for pkg in auth common utils config contracts core metrics plugin; do \
	mv "./dist/packages/$pkg" "./node_modules/@gauzy/$pkg" \
	&& if [ -d "./packages/$pkg/node_modules" ]; then \
	mv  "./packages/$pkg/node_modules" "./node_modules/@gauzy/$pkg/node_modules"; \
	fi; \
	done \
	&& for plugin in changelog integration-ai integration-github integration-hubstaff \
	integration-jira integration-upwork jitsu-analytics job-proposal job-search \
	knowledge-base product-reviews sentry-tracing videos; do \
	mv "./dist/packages/plugins/$plugin" "./node_modules/@gauzy/plugin-${plugin}" \
	&& if [ -d "./packages/plugins/$plugin/node_modules" ]; then \
	mv  "./packages/plugins/$plugin/node_modules" "./node_modules/@gauzy/plugin-${plugin}/node_modules"; \
	fi; \
	done \
	&& mv "./node_modules/@gauzy/plugin-sentry-tracing" "./node_modules/@gauzy/plugin-sentry" \
	&& cp -r ./seed/* ./apps/api/public

# Copy the entrypoint scripts
COPY --chmod=755 wait .deploy/api/entrypoint.prod.sh .deploy/api/entrypoint.compose.sh ./

ENV GIT_HASH=${GIT_HASH:-""} \
	NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=12288"} \
	NODE_ENV=${NODE_ENV:-production} \
	API_HOST=${API_HOST:-localhost} \
	API_PORT=${API_PORT:-3000} \
	API_BASE_URL=${API_BASE_URL:-http://localhost:3000} \
	CLIENT_BASE_URL=${CLIENT_BASE_URL:-http://localhost:4200} \
	SENTRY_DSN=${SENTRY_DSN} \
	SENTRY_HTTP_TRACING_ENABLED=${SENTRY_HTTP_TRACING_ENABLED:-false} \
	SENTRY_PROFILING_ENABLED=${SENTRY_PROFILING_ENABLED:-false} \
	SENTRY_POSTGRES_TRACKING_ENABLED=${SENTRY_POSTGRES_TRACKING_ENABLED:-false} \
	DB_URI=${DB_URI} \
	DB_HOST=${DB_HOST:-db} \
	DB_NAME=${DB_NAME:-postgres} \
	DB_PORT=${DB_PORT:-5432} \
	DB_USER=${DB_USER} \
	DB_PASS=${DB_PASS} \
	DB_TYPE=${DB_TYPE:-better-sqlite3} \
	DB_SSL_MODE=${DB_SSL_MODE} \
	DB_CA_CERT=${DB_CA_CERT} \
	DB_POOL_SIZE=${DB_POOL_SIZE} \
	DB_POOL_SIZE_KNEX=${DB_POOL_SIZE_KNEX} \
	DEMO=${DEMO:-false} \
	CLOUD_PROVIDER=${CLOUD_PROVIDER} \
	AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID} \
	AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY} \
	AWS_REGION=${AWS_REGION} \
	AWS_S3_BUCKET=${AWS_S3_BUCKET} \
	WASABI_ACCESS_KEY_ID=${WASABI_ACCESS_KEY_ID} \
	WASABI_SECRET_ACCESS_KEY=${WASABI_SECRET_ACCESS_KEY} \
	WASABI_REGION=${WASABI_REGION} \
	WASABI_SERVICE_URL=${WASABI_SERVICE_URL} \
	WASABI_S3_BUCKET=${WASABI_S3_BUCKET} \
	WASABI_S3_FORCE_PATH_STYLE=${WASABI_S3_FORCE_PATH_STYLE} \
	DIGITALOCEAN_ACCESS_KEY_ID=${DIGITALOCEAN_ACCESS_KEY_ID} \
	DIGITALOCEAN_SECRET_ACCESS_KEY=${DIGITALOCEAN_SECRET_ACCESS_KEY} \
	DIGITALOCEAN_REGION=${DIGITALOCEAN_REGION} \
	DIGITALOCEAN_SERVICE_URL=${DIGITALOCEAN_SERVICE_URL} \
	DIGITALOCEAN_CDN_URL=${DIGITALOCEAN_CDN_URL} \
	DIGITALOCEAN_S3_BUCKET=${DIGITALOCEAN_S3_BUCKET} \
	DIGITALOCEAN_S3_FORCE_PATH_STYLE=${DIGITALOCEAN_S3_FORCE_PATH_STYLE:-false} \
	EXPRESS_SESSION_SECRET=${EXPRESS_SESSION_SECRET:-gauzy} \
	JWT_SECRET=${JWT_SECRET:-secretKey} \
	JWT_REFRESH_TOKEN_SECRET=${JWT_REFRESH_TOKEN_SECRET:-refreshSecretKey} \
	REFRESH_TOKEN_EXPIRATION_TIME=${REFRESH_TOKEN_EXPIRATION_TIME:-86400} \
	MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS} \
	MAIL_HOST=${MAIL_HOST} \
	MAIL_PORT=${MAIL_PORT} \
	MAIL_USERNAME=${MAIL_USERNAME} \
	MAIL_PASSWORD=${MAIL_PASSWORD} \
	ALLOW_SUPER_ADMIN_ROLE=${ALLOW_SUPER_ADMIN_ROLE} \
	GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID} \
	GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET} \
	GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL} \
	FACEBOOK_CLIENT_ID=${FACEBOOK_CLIENT_ID} \
	FACEBOOK_CLIENT_SECRET=${FACEBOOK_CLIENT_SECRET} \
	FACEBOOK_GRAPH_VERSION=${FACEBOOK_GRAPH_VERSION} \
	FACEBOOK_CALLBACK_URL=${FACEBOOK_CALLBACK_URL} \
	INTEGRATED_USER_DEFAULT_PASS=${INTEGRATED_USER_DEFAULT_PASS} \
	UPWORK_REDIRECT_URL=${UPWORK_REDIRECT_URL} \
	HUBSTAFF_CLIENT_ID=${HUBSTAFF_CLIENT_ID} \
	HUBSTAFF_CLIENT_SECRET=${HUBSTAFF_CLIENT_SECRET} \
	HUBSTAFF_PERSONAL_ACCESS_TOKEN=${HUBSTAFF_PERSONAL_ACCESS_TOKEN} \
	FILE_PROVIDER=${FILE_PROVIDER} \
	GAUZY_AI_GRAPHQL_ENDPOINT=${GAUZY_AI_GRAPHQL_ENDPOINT} \
	GAUZY_AI_REST_ENDPOINT=${GAUZY_AI_REST_ENDPOINT} \
	DEFAULT_CURRENCY=${DEFAULT_CURRENCY} \
	CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME} \
	CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY} \
	UNLEASH_APP_NAME=${UNLEASH_APP_NAME} \
	UNLEASH_API_URL=${UNLEASH_API_URL} \
	UNLEASH_INSTANCE_ID=${UNLEASH_INSTANCE_ID} \
	UNLEASH_REFRESH_INTERVAL=${UNLEASH_REFRESH_INTERVAL} \
	UNLEASH_METRICS_INTERVAL=${UNLEASH_METRICS_INTERVAL} \
	UNLEASH_API_KEY=${UNLEASH_API_KEY} \
	PM2_PUBLIC_KEY=${PM2_PUBLIC_KEY} \
	PM2_SECRET_KEY=${PM2_SECRET_KEY} \
	PM2_MACHINE_NAME=${PM2_MACHINE_NAME} \
	JITSU_SERVER_URL=${JITSU_SERVER_URL} \
	JITSU_SERVER_WRITE_KEY=${JITSU_SERVER_WRITE_KEY} \
	GAUZY_GITHUB_CLIENT_ID=${GAUZY_GITHUB_CLIENT_ID} \
	GAUZY_GITHUB_CLIENT_SECRET=${GAUZY_GITHUB_CLIENT_SECRET} \
	GAUZY_GITHUB_WEBHOOK_URL=${GAUZY_GITHUB_WEBHOOK_URL} \
	GAUZY_GITHUB_WEBHOOK_SECRET=${GAUZY_GITHUB_WEBHOOK_SECRET} \
	GAUZY_GITHUB_APP_PRIVATE_KEY=${GAUZY_GITHUB_APP_PRIVATE_KEY} \
	GAUZY_GITHUB_APP_ID=${GAUZY_GITHUB_APP_ID} \
	GAUZY_GITHUB_APP_NAME=${GAUZY_GITHUB_APP_NAME} \
	GAUZY_GITHUB_POST_INSTALL_URL=${GAUZY_GITHUB_POST_INSTALL_URL} \
	GAUZY_GITHUB_OAUTH_CLIENT_ID=${GAUZY_GITHUB_OAUTH_CLIENT_ID} \
	GAUZY_GITHUB_OAUTH_CLIENT_SECRET=${GAUZY_GITHUB_OAUTH_CLIENT_SECRET} \
	GAUZY_GITHUB_OAUTH_CALLBACK_URL=${GAUZY_GITHUB_OAUTH_CALLBACK_URL} \
	MAGIC_CODE_EXPIRATION_TIME=${MAGIC_CODE_EXPIRATION_TIME} \
	APP_NAME=${APP_NAME} \
	APP_SIGNATURE=${APP_SIGNATURE} \
	APP_LINK=${APP_LINK} \
	APP_EMAIL_CONFIRMATION_URL=${APP_EMAIL_CONFIRMATION_URL} \
	APP_MAGIC_SIGN_URL=${APP_MAGIC_SIGN_URL} \
	COMPANY_LINK=${COMPANY_LINK} \
	COMPANY_NAME=${COMPANY_NAME} \
	OTEL_ENABLED=${OTEL_ENABLED} \
	OTEL_PROVIDER=${OTEL_PROVIDER} \
	OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT} \
	OTEL_EXPORTER_OTLP_HEADERS=${OTEL_EXPORTER_OTLP_HEADERS} \
	REDIS_ENABLED=${REDIS_ENABLED} \
	REDIS_URL=${REDIS_URL} \
	PERIODIC_TIME_SAVE="true" \
	PERIODIC_TIME_SAVE_TIMEFRAME="60" \
	DB_ORM=${DB_ORM:-"typeorm"} \
	MIKRO_ORM_ALLOW_GLOBAL_CONTEXT=${MIKRO_ORM_ALLOW_GLOBAL_CONTEXT:-false}


EXPOSE ${API_PORT}

USER node

ENTRYPOINT [ "./entrypoint.prod.sh" ]
CMD [ "node", "main.js" ]
