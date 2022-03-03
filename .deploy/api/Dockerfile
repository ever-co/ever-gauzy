# Ever Gauzy Platform API (Core)

ARG NODE_OPTIONS
ARG NODE_ENV
ARG API_BASE_URL
ARG CLIENT_BASE_URL
ARG API_HOST
ARG API_PORT
ARG SENTRY_DSN
ARG DB_URI
ARG DB_HOST
ARG DB_NAME
ARG DB_PORT
ARG DB_USER
ARG DB_PASS
ARG DB_TYPE
ARG DB_SSL_MODE
ARG DB_CA_CERT
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
ARG EXPRESS_SESSION_SECRET
ARG JWT_SECRET
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
ARG UPWORK_CALLBACK_URL
ARG FILE_PROVIDER
ARG GAUZY_AI_GRAPHQL_ENDPOINT
ARG DEFAULT_CURRENCY
ARG CLOUDINARY_CLOUD_NAME
ARG CLOUDINARY_API_KEY
ARG UNLEASH_APP_NAME
ARG UNLEASH_API_URL
ARG UNLEASH_INSTANCE_ID
ARG UNLEASH_REFRESH_INTERVAL
ARG UNLEASH_METRICS_INTERVAL

FROM node:16-alpine3.14 AS dependencies

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source https://github.com/ever-co/ever-gauzy

ENV CI=true

RUN apk --update add bash \
    && apk add libexecinfo libexecinfo-dev \
	&& npm i -g npm \
    && apk add --no-cache --virtual build-dependencies build-base \
    snappy libheif dos2unix gcc g++ snappy-dev git libgcc libstdc++ linux-headers autoconf automake make nasm python2 py2-setuptools vips-dev vips \
    && npm install --quiet node-gyp -g \
	&& npm config set python /usr/bin/python \
	&& npm install yarn -g --force \
    && mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/api/entrypoint.prod.sh .deploy/api/entrypoint.compose.sh /
RUN chmod +x /wait /entrypoint.compose.sh /entrypoint.prod.sh && dos2unix /entrypoint.prod.sh && dos2unix /entrypoint.compose.sh

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/gauzy/package.json ./apps/gauzy/
COPY --chown=node:node apps/api/package.json ./apps/api/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/common-angular/package.json ./packages/common-angular/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./

RUN yarn install --network-timeout 1000000 --frozen-lockfile && yarn cache clean
# RUN apk del build-dependencies make gcc g++ python2 py2-setuptools vips-dev

FROM node:16-alpine3.14 AS prodDependencies

RUN apk --update add bash \
    && apk add libexecinfo libexecinfo-dev \
	&& npm i -g npm \
    && apk add --no-cache --virtual build-dependencies build-base \
    snappy libheif dos2unix gcc g++ snappy-dev git libgcc libstdc++ linux-headers autoconf automake make nasm python2 py2-setuptools vips-dev vips \
    && npm install --quiet node-gyp -g \
	&& npm config set python /usr/bin/python \
	&& npm install yarn -g --force \
    && mkdir /srv/gauzy && chown -R node:node /srv/gauzy

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/api/package.json ./apps/api/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/

COPY --chown=node:node package.json yarn.lock ./

RUN yarn install --network-timeout 1000000 --frozen-lockfile --production && yarn cache clean
# RUN apk del build-dependencies make gcc g++ python2 py2-setuptools vips-dev

RUN rm -r node_modules/@angular

FROM node:16-alpine3.14 AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:16-alpine3.14 AS build

WORKDIR /srv/gauzy

RUN mkdir dist

COPY --chown=node:node --from=development /srv/gauzy .

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=2048"}
ENV NODE_ENV=${NODE_ENV:-production}
ENV DEMO=${DEMO:-false}

ENV IS_DOCKER=true

RUN yarn build:package:api
RUN yarn build:api:prod

FROM node:16-alpine3.14 AS production

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh ./
COPY --chown=node:node --from=prodDependencies /srv/gauzy/node_modules/ ./node_modules/
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

RUN npm install pm2 -g && \
    mkdir /import && chown node:node /import && \
    touch ormlogs.log && chown node:node ormlogs.log && chown node:node wait && \
    chmod +x wait entrypoint.compose.sh entrypoint.prod.sh && chown -R node:node apps/

USER node:node

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=2048"}
ENV NODE_ENV=${NODE_ENV:-production}
ENV API_HOST=${API_HOST:-api}
ENV API_PORT=${API_PORT:-3000}
ENV API_BASE_URL=${API_BASE_URL:-http://localhost:3000}
ENV CLIENT_BASE_URL=${CLIENT_BASE_URL:-http://localhost:4200}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV DB_URI=${DB_URI}
ENV DB_HOST=${DB_HOST:-db}
ENV DB_NAME=${DB_NAME:-postgres}
ENV DB_PORT=${DB_PORT:-5432}
ENV DB_USER=${DB_USER}
ENV DB_PASS=${DB_PASS}
ENV DB_TYPE=${DB_TYPE:-sqlite}
ENV DB_SSL_MODE=${DB_SSL_MODE}
ENV DB_CA_CERT=${DB_CA_CERT}
ENV DEMO=${DEMO:-false}
ENV AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
ENV AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
ENV AWS_REGION=${AWS_REGION}
ENV AWS_S3_BUCKET=${AWS_S3_BUCKET}
ENV WASABI_ACCESS_KEY_ID=${WASABI_ACCESS_KEY_ID}
ENV WASABI_SECRET_ACCESS_KEY=${WASABI_SECRET_ACCESS_KEY}
ENV WASABI_REGION=${WASABI_REGION}
ENV WASABI_SERVICE_URL=${WASABI_SERVICE_URL}
ENV WASABI_S3_BUCKET=${WASABI_S3_BUCKET}
ENV EXPRESS_SESSION_SECRET=${EXPRESS_SESSION_SECRET:-gauzy}
ENV JWT_SECRET=${JWT_SECRET:-secretKey}
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
ENV UPWORK_CALLBACK_URL=${UPWORK_CALLBACK_URL}
ENV FILE_PROVIDER=${FILE_PROVIDER}
ENV GAUZY_AI_GRAPHQL_ENDPOINT=${GAUZY_AI_GRAPHQL_ENDPOINT}
ENV DEFAULT_CURRENCY=${DEFAULT_CURRENCY}
ENV CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
ENV CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
ENV UNLEASH_APP_NAME=${UNLEASH_APP_NAME}
ENV UNLEASH_API_URL=${UNLEASH_API_URL}
ENV UNLEASH_INSTANCE_ID=${UNLEASH_INSTANCE_ID}
ENV UNLEASH_REFRESH_INTERVAL=${UNLEASH_REFRESH_INTERVAL}
ENV UNLEASH_METRICS_INTERVAL=${UNLEASH_METRICS_INTERVAL}

EXPOSE ${API_PORT}

ENTRYPOINT [ "./entrypoint.prod.sh" ]

CMD [ "pm2-runtime", "main.js" ]
