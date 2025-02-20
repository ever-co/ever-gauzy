# Ever Gauzy Platform API (Core)

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
ARG PM2_PUBLIC_KEY
ARG PM2_SECRET_KEY
ARG PM2_MACHINE_NAME
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
ARG APP_LOGO
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

FROM node:20.11.1-alpine3.19 AS builder

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

ARG NODE_ENV
ARG DEMO
ARG NODE_OPTIONS

ENV CI=true \
	NODE_ENV_ARG=${NODE_ENV} \
	# Set Python interpreter for `node-gyp` to use
	PYTHON=/usr/bin/python

#  snappy libheif snappy-dev vips-dev vips
RUN apk --update add bash \
	&& apk add --no-cache build-base \
	&& npm i -g npm@9 node-gyp@10.2.0 yarn --force \
	&& mkdir /srv/gauzy \
	&& chown -R node:node /srv/gauzy \
	&& rm -rf /var/cache/apk/*

COPY --chmod=755 wait .deploy/api/entrypoint.prod.sh .deploy/api/entrypoint.compose.sh /

USER node:node
WORKDIR /srv/gauzy

# Copy related project files and configuration files
COPY --chown=node:node . .

# Set the environment variables
ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=60000"} \
	NODE_ENV=${NODE_ENV_ARG:-"development"} \
	DEMO=${DEMO:-false} \
	IS_DOCKER=true \
	NX_NO_CLOUD=true

# Install project production dependencies
RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts --production \
	&& yarn postinstall.manual \
	&& rm -rf node_modules/@angular \
	&& cp -r ./node_modules ./node_modules_prod \
	# Install project development dependencies
	&& NODE_ENV=development yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts \
	&& yarn postinstall.manual \
	&& yarn cache clean \
	# Build the API service for production
	&& yarn build:api:prod:docker \
	&& rm -rf ./node_modules

FROM node:20.11.1-alpine3.19 AS production
# Prepare PM2 and dependencies
RUN npm install pm2@4.5.1 -g \
	&& mkdir /import \
	&& chown node:node /import \
	&& touch ormlogs.log \
	&& chown node:node ormlogs.log \
	&& yarn cache clean

USER node:node
WORKDIR /srv/gauzy

# Copy the entrypoint scripts
COPY --from=builder --chmod=755 /wait /entrypoint.prod.sh /entrypoint.compose.sh ./

# Copy the built API items and prepare dependencies
COPY --chown=node:node --from=builder /srv/gauzy/dist/apps/api/assets /srv/gauzy/dist/apps/api/public /srv/gauzy/dist/apps/api/main.* ./
COPY --chown=node:node --from=builder /srv/gauzy/dist/packages/ ./packages/
COPY --chown=node:node --from=builder /srv/gauzy/node_modules_prod ./node_modules

# Fix @guazy dependencies
RUN rm -rf ./node_modules/@gauzy \
	&& mkdir -p ./node_modules/@gauzy \
	&& for pkg in auth common utils config contracts core plugin; do \
	mv "./packages/$pkg" "./node_modules/@gauzy/$pkg"; \
	done \
	&& for plugin in changelog integration-ai integration-github integration-hubstaff integration-jira integration-upwork jitsu-analytics job-proposal job-search knowledge-base product-reviews sentry-tracing videos; do \
	mv "./packages/plugins/$plugin" "./node_modules/@gauzy/plugin-$plugin"; \
	done \
	&& mv "./node_modules/@gauzy/plugin-sentry-tracing" "./node_modules/@gauzy/plugin-sentry" || true \
	&& rm -rf /tmp/gauzy

# we need node_modules inside each @gauzy package
COPY --chown=node:node --from=builder /srv/gauzy/packages/auth/node_modules ./node_modules/@gauzy/auth/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/common/node_modules ./node_modules/@gauzy/common/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/utils/node_modules ./node_modules/@gauzy/utils/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/config/node_modules ./node_modules/@gauzy/config/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/contracts/node_modules ./node_modules/@gauzy/contracts/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/core/node_modules ./node_modules/@gauzy/core/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/changelog/node_modules ./node_modules/@gauzy/plugin-changelog/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/integration-ai/node_modules ./node_modules/@gauzy/plugin-integration-ai/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/integration-github/node_modules ./node_modules/@gauzy/plugin-integration-github/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/integration-hubstaff/node_modules ./node_modules/@gauzy/plugin-integration-hubstaff/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/integration-jira/node_modules ./node_modules/@gauzy/plugin-integration-jira/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/integration-upwork/node_modules ./node_modules/@gauzy/plugin-integration-upwork/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/jitsu-analytics/node_modules ./node_modules/@gauzy/plugin-jitsu-analytics/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/job-proposal/node_modules ./node_modules/@gauzy/plugin-job-proposal/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/job-search/node_modules ./node_modules/@gauzy/plugin-job-search/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/knowledge-base/node_modules ./node_modules/@gauzy/plugin-knowledge-base/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/product-reviews/node_modules ./node_modules/@gauzy/plugin-product-reviews/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/sentry-tracing/node_modules ./node_modules/@gauzy/plugin-sentry/node_modules
COPY --chown=node:node --from=builder /srv/gauzy/packages/plugins/videos/node_modules ./node_modules/@gauzy/plugin-videos/node_modules

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=12288"} \
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
	APP_LOGO=${APP_LOGO} \
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
	PERIODIC_TIME_SAVE_TIMEFRAME="60"

EXPOSE ${API_PORT}

ENTRYPOINT [ "./entrypoint.prod.sh" ]
CMD [ "node", "main.js" ]
