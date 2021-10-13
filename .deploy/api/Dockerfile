ARG NODE_OPTIONS
ARG NODE_ENV
ARG API_BASE_URL
ARG API_HOST
ARG API_PORT
ARG SENTRY_DSN
ARG DB_HOST
ARG DB_NAME
ARG DB_PORT
ARG DB_USER
ARG DB_PASS
ARG DB_TYPE
ARG DB_SSL_MODE
ARG DEMO

FROM node:16-alpine3.11 AS dependencies

LABEL maintainer="ever@ever.co"

ENV CI=true

RUN apk --update add bash && \
    apk add --no-cache --virtual build-dependencies dos2unix gcc g++ git make python2 py2-setuptools vips-dev && \
    mkdir /srv/gauzy && chown -R node:node /srv/gauzy

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

RUN yarn install --frozen-lockfile && yarn cache clean
# RUN apk del build-dependencies make gcc g++ python2 py2-setuptools vips-dev

FROM node:16-alpine3.11 AS prodDependencies

RUN apk --update add bash && \
    apk add --no-cache --virtual build-dependencies dos2unix gcc g++ git make python2 py2-setuptools vips-dev && \
    mkdir /srv/gauzy && chown -R node:node /srv/gauzy

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

RUN yarn install --frozen-lockfile --production && yarn cache clean 
# RUN apk del build-dependencies make gcc g++ python2 py2-setuptools vips-dev

RUN rm -r node_modules/@angular

FROM node:16-alpine3.11 AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:16-alpine3.11 AS build

WORKDIR /srv/gauzy

RUN mkdir dist

COPY --chown=node:node --from=development /srv/gauzy .

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=2048"}
ENV NODE_ENV=${NODE_ENV:-production}
ENV DEMO=${DEMO:-false}

ENV IS_DOCKER=true

RUN yarn build:package:api
RUN yarn build:api:prod

FROM node:16-alpine3.11 AS production

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh ./
COPY --chown=node:node --from=prodDependencies /srv/gauzy/node_modules/ ./node_modules/
COPY --chown=node:node --from=build /srv/gauzy/packages/ ./packages/

# copy static assets files which used for example in the seeds (e.g. images for features, reports, screenshots)
COPY --chown=node:node apps/api/src/assets apps/api/src/assets

# copy folder to which we later move static assets (e.g. images for features, reports, screenshots)
COPY --chown=node:node apps/api/public apps/api/public

COPY --chown=node:node --from=build /srv/gauzy/dist/apps/api .

RUN npm install pm2 -g && \
    mkdir /import && chown node:node /import && \
    touch ormlogs.log && chown node:node ormlogs.log && chown node:node wait && \
    chmod +x wait && chown -R node:node apps/
    
USER node:node

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=2048"}
ENV NODE_ENV=${NODE_ENV:-production}
ENV API_HOST=${API_HOST:-api}
ENV API_PORT=${API_PORT:-3000}
ENV API_BASE_URL=${API_BASE_URL:-http://localhost:3000}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV DB_HOST=${DB_HOST:-db}
ENV DB_NAME=${DB_NAME:-postgres}
ENV DB_PORT=${DB_PORT:-5432}
ENV DB_USER=${DB_USER}
ENV DB_PASS=${DB_PASS}
ENV DB_TYPE=${DB_TYPE:-sqlite}
ENV DB_SSL_MODE=${DB_SSL_MODE}
ENV DEMO=${DEMO:-false}

EXPOSE ${API_PORT}

CMD [ "pm2-runtime", "main.js" ]
