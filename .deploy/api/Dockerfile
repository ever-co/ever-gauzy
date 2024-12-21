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

FROM node:20.11.1-alpine3.19 AS dependencies

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source https://github.com/ever-co/ever-gauzy

ENV CI=true

# We need to set to "development", because we are using "yarn install" below to setup
# devDependencies even for production builds!
ENV NODE_ENV=development

# Set Python interpreter for `node-gyp` to use
ENV PYTHON /usr/bin/python

RUN apk --update add bash && npm i -g npm@9 \
	&& apk add --no-cache --virtual build-dependencies bind-tools curl tar xz jq python3 python3-dev py3-configobj py3-pip py3-setuptools build-base \
	snappy libheif dos2unix gcc g++ snappy-dev git libgcc libstdc++ linux-headers autoconf automake make nasm vips-dev vips

# Verify the Node.js version
RUN node --version
RUN npm --version

# Output Python3 version
RUN python3 --version

RUN npm install --quiet node-gyp@10.2.0 -g
RUN npm install yarn -g --force
RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/api/entrypoint.prod.sh .deploy/api/entrypoint.compose.sh /
RUN chmod +x /wait /entrypoint.compose.sh /entrypoint.prod.sh && dos2unix /entrypoint.prod.sh && dos2unix /entrypoint.compose.sh

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/gauzy/package.json ./apps/gauzy/
COPY --chown=node:node apps/api/package.json ./apps/api/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/plugins/integration-ai-ui/package.json ./packages/plugins/integration-ai-ui/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff-ui/package.json ./packages/plugins/integration-hubstaff-ui/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork-ui/package.json ./packages/plugins/integration-upwork-ui/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/integration-github/package.json ./packages/plugins/integration-github/
COPY --chown=node:node packages/plugins/integration-github-ui/package.json ./packages/plugins/integration-github-ui/
COPY --chown=node:node packages/plugins/integration-jira/package.json ./packages/plugins/integration-jira/
COPY --chown=node:node packages/plugins/jitsu-analytics/package.json ./packages/plugins/jitsu-analytics/
COPY --chown=node:node packages/plugins/sentry-tracing/package.json ./packages/plugins/sentry-tracing/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/
COPY --chown=node:node packages/plugins/job-search/package.json ./packages/plugins/job-search/
COPY --chown=node:node packages/plugins/job-proposal/package.json ./packages/plugins/job-proposal/
COPY --chown=node:node packages/plugins/job-employee-ui/package.json ./packages/plugins/job-employee-ui/
COPY --chown=node:node packages/plugins/job-matching-ui/package.json ./packages/plugins/job-matching-ui/
COPY --chown=node:node packages/plugins/job-proposal-ui/package.json ./packages/plugins/job-proposal-ui/
COPY --chown=node:node packages/plugins/job-search-ui/package.json ./packages/plugins/job-search-ui/
COPY --chown=node:node packages/plugins/legal-ui/package.json ./packages/plugins/legal-ui/
COPY --chown=node:node packages/plugins/maintenance-ui/package.json ./packages/plugins/maintenance-ui/
COPY --chown=node:node packages/plugins/onboarding-ui/package.json ./packages/plugins/onboarding-ui/
COPY --chown=node:node packages/plugins/public-layout-ui/package.json ./packages/plugins/public-layout-ui/
COPY --chown=node:node packages/ui-core/package.json ./packages/ui-core/
COPY --chown=node:node packages/ui-config/package.json ./packages/ui-config/
COPY --chown=node:node packages/ui-auth/package.json ./packages/ui-auth/

# We do not build here Wakatime plugin, because it used in Desktop Apps for now
# COPY --chown=node:node packages/plugins/integration-wakatime/package.json ./packages/plugins/integration-wakatime/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./

RUN yarn install --network-timeout 1000000 --frozen-lockfile
# RUN apk del build-dependencies make gcc g++ python2 py2-setuptools vips-dev

FROM node:20.11.1-alpine3.19 AS prodDependencies

ENV CI=true

# We make NODE_ENV passed as build argument to be available in this stage
ARG NODE_ENV

# Set Python interpreter for `node-gyp` to use
ENV PYTHON /usr/bin/python

RUN apk --update add bash && npm i -g npm@9 \
	&& apk add --no-cache --virtual build-dependencies bind-tools curl tar xz jq python3 python3-dev py3-configobj py3-pip py3-setuptools build-base \
	snappy libheif dos2unix gcc g++ snappy-dev git libgcc libstdc++ linux-headers autoconf automake make nasm vips-dev vips

# Verify the Node.js version
RUN node --version
RUN npm --version

# Output Python3 version
RUN python3 --version

RUN npm install --quiet node-gyp@10.2.0 -g
RUN npm install yarn -g --force
RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/api/package.json ./apps/api/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/plugins/integration-ai-ui/package.json ./packages/plugins/integration-ai-ui/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff-ui/package.json ./packages/plugins/integration-hubstaff-ui/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork-ui/package.json ./packages/plugins/integration-upwork-ui/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/integration-github/package.json ./packages/plugins/integration-github/
COPY --chown=node:node packages/plugins/integration-github-ui/package.json ./packages/plugins/integration-github-ui/
COPY --chown=node:node packages/plugins/integration-jira/package.json ./packages/plugins/integration-jira/
COPY --chown=node:node packages/plugins/jitsu-analytics/package.json ./packages/plugins/jitsu-analytics/
COPY --chown=node:node packages/plugins/sentry-tracing/package.json ./packages/plugins/sentry-tracing/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/
COPY --chown=node:node packages/plugins/job-search/package.json ./packages/plugins/job-search/
COPY --chown=node:node packages/plugins/job-proposal/package.json ./packages/plugins/job-proposal/
COPY --chown=node:node packages/plugins/job-employee-ui/package.json ./packages/plugins/job-employee-ui/
COPY --chown=node:node packages/plugins/job-matching-ui/package.json ./packages/plugins/job-matching-ui/
COPY --chown=node:node packages/plugins/job-proposal-ui/package.json ./packages/plugins/job-proposal-ui/
COPY --chown=node:node packages/plugins/job-search-ui/package.json ./packages/plugins/job-search-ui/
COPY --chown=node:node packages/plugins/public-layout-ui/package.json ./packages/plugins/public-layout-ui/
COPY --chown=node:node packages/plugins/legal-ui/package.json ./packages/plugins/legal-ui/
COPY --chown=node:node packages/plugins/maintenance-ui/package.json ./packages/plugins/maintenance-ui/
COPY --chown=node:node packages/plugins/onboarding-ui/package.json ./packages/plugins/onboarding-ui/
COPY --chown=node:node packages/ui-core/package.json ./packages/ui-core/
COPY --chown=node:node packages/ui-config/package.json ./packages/ui-config/
COPY --chown=node:node packages/ui-auth/package.json ./packages/ui-auth/

# We do not build here Wakatime plugin, because it used in Desktop Apps for now
# COPY --chown=node:node packages/plugins/integration-wakatime/package.json ./packages/plugins/integration-wakatime/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./

RUN yarn install --network-timeout 1000000 --frozen-lockfile --production && yarn cache clean

RUN rm -r node_modules/@angular

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
ARG NODE_ENV
ARG DEMO
ARG NODE_OPTIONS

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=60000"}
ENV NODE_ENV=${NODE_ENV}
ENV DEMO=${DEMO:-false}

ENV IS_DOCKER=true

# Temporary disable caching in NX Cloud for builds
ENV NX_NO_CLOUD=true

RUN if [ "$NODE_ENV" = "production" ]; then \
	yarn build:package:api:docker; \
	else \
	yarn build:package:api; \
	fi

RUN yarn build:api:prod:docker

FROM node:20.11.1-alpine3.19 AS production

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh ./
# COPY --chown=node:node --from=prodDependencies /srv/gauzy/node_modules/ ./node_modules/
COPY --chown=node:node --from=build /srv/gauzy/packages/ ./packages/

# Copy static assets files which used for example in the seeds (e.g. images for features, reports, screenshots)
COPY --chown=node:node apps/api/src/assets apps/api/src/assets

# Copy folder to which we later move static assets (e.g. images for features, reports, screenshots)
COPY --chown=node:node apps/api/public apps/api/public

# Copy static assets used in seeds (e.g. reports screenshots images, see report.seed.ts) to public folder.
# We are doing it in the seed code too, however if DB seed already was done one time and
# docker container rebuilds, we will not have images unless we copy them during docker build manually here.
COPY --chown=node:node apps/api/src/assets/seed apps/api/public

COPY --chown=node:node --from=build /srv/gauzy/dist/apps/api .

RUN npm install pm2@4.5.1 -g && \
	mkdir /import && chown node:node /import && \
	touch ormlogs.log && chown node:node ormlogs.log && chown node:node wait && \
	chmod +x wait entrypoint.compose.sh entrypoint.prod.sh && chown -R node:node apps/

# Clean up
RUN yarn cache clean

USER node:node

ENV CI=true

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=12288"}
ENV NODE_ENV=${NODE_ENV:-production}
ENV API_HOST=${API_HOST:-api}
ENV API_PORT=${API_PORT:-3000}
ENV API_BASE_URL=${API_BASE_URL:-http://localhost:3000}
ENV CLIENT_BASE_URL=${CLIENT_BASE_URL:-http://localhost:4200}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV SENTRY_HTTP_TRACING_ENABLED=${SENTRY_HTTP_TRACING_ENABLED:-false}
ENV SENTRY_PROFILING_ENABLED=${SENTRY_PROFILING_ENABLED:-false}
ENV SENTRY_POSTGRES_TRACKING_ENABLED=${SENTRY_POSTGRES_TRACKING_ENABLED:-false}
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
ENV DEMO=${DEMO:-false}
ENV CLOUD_PROVIDER=${CLOUD_PROVIDER}
ENV AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
ENV AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
ENV AWS_REGION=${AWS_REGION}
ENV AWS_S3_BUCKET=${AWS_S3_BUCKET}
ENV WASABI_ACCESS_KEY_ID=${WASABI_ACCESS_KEY_ID}
ENV WASABI_SECRET_ACCESS_KEY=${WASABI_SECRET_ACCESS_KEY}
ENV WASABI_REGION=${WASABI_REGION}
ENV WASABI_SERVICE_URL=${WASABI_SERVICE_URL}
ENV WASABI_S3_BUCKET=${WASABI_S3_BUCKET}
ENV WASABI_S3_FORCE_PATH_STYLE=${WASABI_S3_FORCE_PATH_STYLE}
ENV DIGITALOCEAN_ACCESS_KEY_ID=${DIGITALOCEAN_ACCESS_KEY_ID}
ENV DIGITALOCEAN_SECRET_ACCESS_KEY=${DIGITALOCEAN_SECRET_ACCESS_KEY}
ENV DIGITALOCEAN_REGION=${DIGITALOCEAN_REGION}
ENV DIGITALOCEAN_SERVICE_URL=${DIGITALOCEAN_SERVICE_URL}
ENV DIGITALOCEAN_CDN_URL=${DIGITALOCEAN_CDN_URL}
ENV DIGITALOCEAN_S3_BUCKET=${DIGITALOCEAN_S3_BUCKET}
ENV DIGITALOCEAN_S3_FORCE_PATH_STYLE=${DIGITALOCEAN_S3_FORCE_PATH_STYLE:-false}
ENV EXPRESS_SESSION_SECRET=${EXPRESS_SESSION_SECRET:-gauzy}
ENV JWT_SECRET=${JWT_SECRET:-secretKey}
ENV JWT_REFRESH_TOKEN_SECRET=${JWT_REFRESH_TOKEN_SECRET:-refreshSecretKey}
ENV REFRESH_TOKEN_EXPIRATION_TIME=${REFRESH_TOKEN_EXPIRATION_TIME:-86400}
ENV MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS}
ENV MAIL_HOST=${MAIL_HOST}
ENV MAIL_PORT=${MAIL_PORT}
ENV MAIL_USERNAME=${MAIL_USERNAME}
ENV MAIL_PASSWORD=${MAIL_PASSWORD}
ENV ALLOW_SUPER_ADMIN_ROLE=${ALLOW_SUPER_ADMIN_ROLE}
ENV GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
ENV GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
ENV GOOGLE_CALLBACK_URL=${GOOGLE_CALLBACK_URL}
ENV FACEBOOK_CLIENT_ID=${FACEBOOK_CLIENT_ID}
ENV FACEBOOK_CLIENT_SECRET=${FACEBOOK_CLIENT_SECRET}
ENV FACEBOOK_GRAPH_VERSION=${FACEBOOK_GRAPH_VERSION}
ENV FACEBOOK_CALLBACK_URL=${FACEBOOK_CALLBACK_URL}
ENV INTEGRATED_USER_DEFAULT_PASS=${INTEGRATED_USER_DEFAULT_PASS}
ENV UPWORK_REDIRECT_URL=${UPWORK_REDIRECT_URL}
ENV HUBSTAFF_CLIENT_ID=${HUBSTAFF_CLIENT_ID}
ENV HUBSTAFF_CLIENT_SECRET=${HUBSTAFF_CLIENT_SECRET}
ENV HUBSTAFF_PERSONAL_ACCESS_TOKEN=${HUBSTAFF_PERSONAL_ACCESS_TOKEN}
ENV FILE_PROVIDER=${FILE_PROVIDER}
ENV GAUZY_AI_GRAPHQL_ENDPOINT=${GAUZY_AI_GRAPHQL_ENDPOINT}
ENV GAUZY_AI_REST_ENDPOINT=${GAUZY_AI_REST_ENDPOINT}
ENV DEFAULT_CURRENCY=${DEFAULT_CURRENCY}
ENV CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
ENV CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
ENV UNLEASH_APP_NAME=${UNLEASH_APP_NAME}
ENV UNLEASH_API_URL=${UNLEASH_API_URL}
ENV UNLEASH_INSTANCE_ID=${UNLEASH_INSTANCE_ID}
ENV UNLEASH_REFRESH_INTERVAL=${UNLEASH_REFRESH_INTERVAL}
ENV UNLEASH_METRICS_INTERVAL=${UNLEASH_METRICS_INTERVAL}
ENV UNLEASH_API_KEY=${UNLEASH_API_KEY}
ENV PM2_PUBLIC_KEY=${PM2_PUBLIC_KEY}
ENV PM2_SECRET_KEY=${PM2_SECRET_KEY}
ENV PM2_MACHINE_NAME=${PM2_MACHINE_NAME}
ENV JITSU_SERVER_URL=${JITSU_SERVER_URL}
ENV JITSU_SERVER_WRITE_KEY=${JITSU_SERVER_WRITE_KEY}
ENV GAUZY_GITHUB_CLIENT_ID=${GAUZY_GITHUB_CLIENT_ID}
ENV GAUZY_GITHUB_CLIENT_SECRET=${GAUZY_GITHUB_CLIENT_SECRET}
ENV GAUZY_GITHUB_WEBHOOK_URL=${GAUZY_GITHUB_WEBHOOK_URL}
ENV GAUZY_GITHUB_WEBHOOK_SECRET=${GAUZY_GITHUB_WEBHOOK_SECRET}
ENV GAUZY_GITHUB_APP_PRIVATE_KEY=${GAUZY_GITHUB_APP_PRIVATE_KEY}
ENV GAUZY_GITHUB_APP_ID=${GAUZY_GITHUB_APP_ID}
ENV GAUZY_GITHUB_APP_NAME=${GAUZY_GITHUB_APP_NAME}
ENV GAUZY_GITHUB_POST_INSTALL_URL=${GAUZY_GITHUB_POST_INSTALL_URL}
ENV GAUZY_GITHUB_OAUTH_CLIENT_ID=${GAUZY_GITHUB_OAUTH_CLIENT_ID}
ENV GAUZY_GITHUB_OAUTH_CLIENT_SECRET=${GAUZY_GITHUB_OAUTH_CLIENT_SECRET}
ENV GAUZY_GITHUB_OAUTH_CALLBACK_URL=${GAUZY_GITHUB_OAUTH_CALLBACK_URL}
ENV MAGIC_CODE_EXPIRATION_TIME=${MAGIC_CODE_EXPIRATION_TIME}
ENV APP_NAME=${APP_NAME}
ENV APP_LOGO=${APP_LOGO}
ENV APP_SIGNATURE=${APP_SIGNATURE}
ENV APP_LINK=${APP_LINK}
ENV APP_EMAIL_CONFIRMATION_URL=${APP_EMAIL_CONFIRMATION_URL}
ENV APP_MAGIC_SIGN_URL=${APP_MAGIC_SIGN_URL}
ENV COMPANY_LINK=${COMPANY_LINK}
ENV COMPANY_NAME=${COMPANY_NAME}
ENV OTEL_ENABLED=${OTEL_ENABLED}
ENV OTEL_PROVIDER=${OTEL_PROVIDER}
ENV OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT}
ENV OTEL_EXPORTER_OTLP_HEADERS=${OTEL_EXPORTER_OTLP_HEADERS}
ENV REDIS_ENABLED=${REDIS_ENABLED}
ENV REDIS_URL=${REDIS_URL}

EXPOSE ${API_PORT}

ENTRYPOINT [ "./entrypoint.prod.sh" ]

CMD [ "node", "main.js" ]
