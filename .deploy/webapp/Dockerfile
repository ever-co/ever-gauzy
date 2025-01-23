# DSpot ERP Platform UI

ARG DEPENDENCIES_IMAGE

ARG NODE_OPTIONS
ARG NODE_ENV
ARG API_BASE_URL
ARG API_HOST
ARG API_PORT
ARG CLIENT_BASE_URL
ARG GAUZY_CLOUD_APP
ARG GAUZY_CLOUD_ENDPOINT
ARG SENTRY_DSN
ARG SENTRY_TRACES_SAMPLE_RATE
ARG SENTRY_PROFILE_SAMPLE_RATE
ARG CHATWOOT_SDK_TOKEN
ARG CHAT_MESSAGE_GOOGLE_MAP
ARG CLOUDINARY_CLOUD_NAME
ARG CLOUDINARY_API_KEY
ARG GOOGLE_MAPS_API_KEY
ARG GOOGLE_PLACE_AUTOCOMPLETE
ARG HUBSTAFF_REDIRECT_URL
ARG DEFAULT_LATITUDE
ARG DEFAULT_LONGITUDE
ARG DEFAULT_CURRENCY
ARG DEFAULT_COUNTRY
ARG DEMO
ARG WEB_HOST
ARG WEB_PORT
ARG GAUZY_GITHUB_CLIENT_ID
ARG GAUZY_GITHUB_APP_NAME
ARG GAUZY_GITHUB_REDIRECT_URL
ARG GAUZY_GITHUB_POST_INSTALL_URL
ARG GAUZY_GITHUB_APP_ID
ARG JITSU_BROWSER_URL
ARG JITSU_BROWSER_WRITE_KEY
ARG FILE_PROVIDER
ARG PLATFORM_PRIVACY_URL
ARG PLATFORM_TOS_URL
ARG PROJECT_REPO
ARG I18N_FILES_URL
ARG COMPANY_NAME
ARG COMPANY_LINK
ARG COMPANY_SITE_NAME
ARG COMPANY_SITE_LINK
ARG COMPANY_GITHUB_LINK
ARG COMPANY_GITLAB_LINK
ARG COMPANY_FACEBOOK_LINK
ARG COMPANY_TWITTER_LINK
ARG COMPANY_IN_LINK
ARG PLATFORM_WEBSITE_URL
ARG PLATFORM_WEBSITE_DOWNLOAD_URL
ARG DESKTOP_APP_DOWNLOAD_LINK_APPLE
ARG DESKTOP_APP_DOWNLOAD_LINK_WINDOWS
ARG DESKTOP_APP_DOWNLOAD_LINK_LINUX
ARG MOBILE_APP_DOWNLOAD_LINK
ARG EXTENSION_DOWNLOAD_LINK

FROM ${DEPENDENCIES_IMAGE:-"no-image"} AS builder

<<<<<<< HEAD
LABEL maintainer="info@dspot.com.pl"
LABEL org.opencontainers.image.source="https://github.com/DSpotDevelopers/gauzy"
=======
LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

ENV CI=true

# We need to set to "development", because we are using "yarn install" below to setup
# devDependencies even for production builds!
ENV NODE_ENV=development

RUN apk --update add bash && npm i -g npm@9 \
	&& apk add --no-cache --virtual build-dependencies bind-tools curl tar xz jq python3 python3-dev py3-configobj py3-pip py3-setuptools dos2unix gcc g++ git make vips-dev && \
	mkdir /srv/gauzy && chown -R node:node /srv/gauzy

# Verify the Node.js version
RUN node --version
RUN npm --version

RUN npm install yarn -g --force

COPY wait .deploy/webapp/entrypoint.compose.sh .deploy/webapp/entrypoint.prod.sh .deploy/webapp/replacements.sed /

RUN chmod +x /wait /entrypoint.compose.sh /entrypoint.prod.sh && dos2unix /entrypoint.compose.sh && dos2unix /entrypoint.prod.sh

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/gauzy/package.json ./apps/gauzy/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
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
COPY --chown=node:node packages/plugins/job-search/package.json ./packages/plugins/job-search/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/
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
COPY --chown=node:node .scripts/postinstall.ts ./.scripts/

# Must be without --production because we need dev deps installed
RUN yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts
RUN yarn postinstall.manual
RUN yarn cache clean

FROM node:20.11.1-alpine3.19 AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.compose.sh /entrypoint.prod.sh /replacements.sed  /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:20.11.1-alpine3.19 AS build

WORKDIR /srv/gauzy

RUN mkdir dist

COPY --chown=node:node --from=development /srv/gauzy .

ENV CI=true
>>>>>>> f02fd16b77 (fix(constants): docker build for @gauzy/constants)

# We make NODE_ENV and other env vars passed as build argument to be available in this stage
ARG NODE_ENV
ARG DEMO
ARG NODE_OPTIONS

WORKDIR /srv/gauzy
USER node

# Copy related project files and configuration files
COPY --chown=node:node . .

# Set the environment variables
ENV CI=true \
	NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=60000"} \
	NODE_ENV=${NODE_ENV:-production} \
	DEMO=${DEMO:-false} \
	IS_DOCKER=true \
	NX_NO_CLOUD=true

# Build the Webapp for production
RUN yarn build:gauzy:prod:docker

FROM nginx:alpine AS production

WORKDIR /srv/gauzy

# Copy the built API items and prepare dependencies
COPY --chown=nginx:nginx .deploy/webapp/nginx.compose.conf /etc/nginx/conf.d/compose.conf.template
COPY --chown=nginx:nginx .deploy/webapp/nginx.prod.conf /etc/nginx/conf.d/prod.conf.template
COPY --chown=nginx:nginx --from=builder /srv/gauzy/dist/apps/gauzy .

# Copy the entrypoint scripts
COPY  --chown=nginx:nginx --chmod=755 wait .deploy/webapp/entrypoint.compose.sh .deploy/webapp/entrypoint.prod.sh .deploy/webapp/replacements.sed ./

RUN chmod a+rw /etc/nginx/conf.d/compose.conf.template /etc/nginx/conf.d/prod.conf.template

ENV CI=true \
	NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=12288"} \
	NODE_ENV=${NODE_ENV:-production} \
	API_HOST=${API_HOST:-api} \
	API_PORT=${API_PORT:-3000} \
	API_BASE_URL=${API_BASE_URL:-http://localhost:3000} \
	CLIENT_BASE_URL=${CLIENT_BASE_URL:-http://localhost:4200} \
	WEB_HOST=${WEB_HOST:-0.0.0.0} \
	WEB_PORT=${WEB_PORT:-4200} \
	DEMO=${DEMO:-false} \
	SENTRY_DSN=${SENTRY_DSN} \
	SENTRY_TRACES_SAMPLE_RATE=${SENTRY_TRACES_SAMPLE_RATE} \
	SENTRY_PROFILE_SAMPLE_RATE=${SENTRY_PROFILE_SAMPLE_RATE} \
	CHATWOOT_SDK_TOKEN=${CHATWOOT_SDK_TOKEN} \
	CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME} \
	CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY} \
	GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY} \
	GOOGLE_PLACE_AUTOCOMPLETE=${GOOGLE_PLACE_AUTOCOMPLETE:-false} \
	DEFAULT_LATITUDE=${DEFAULT_LATITUDE:-42.6459136} \
	DEFAULT_LONGITUDE=${DEFAULT_LONGITUDE:-23.3332736} \
	DEFAULT_CURRENCY=${DEFAULT_CURRENCY:-USD} \
	DEFAULT_COUNTRY=${DEFAULT_COUNTRY} \
	GAUZY_CLOUD_APP=${GAUZY_CLOUD_APP:-"https://app.gauzy.co"} \
	GAUZY_CLOUD_ENDPOINT=${GAUZY_CLOUD_ENDPOINT:-"https://api.gauzy.co"} \
	CHAT_MESSAGE_GOOGLE_MAP=${CHAT_MESSAGE_GOOGLE_MAP} \
	HUBSTAFF_REDIRECT_URL=${HUBSTAFF_REDIRECT_URL} \
	GAUZY_GITHUB_CLIENT_ID=${GAUZY_GITHUB_CLIENT_ID} \
	GAUZY_GITHUB_APP_NAME=${GAUZY_GITHUB_APP_NAME} \
	GAUZY_GITHUB_REDIRECT_URL=${GAUZY_GITHUB_REDIRECT_URL} \
	GAUZY_GITHUB_APP_ID=${GAUZY_GITHUB_APP_ID} \
	GAUZY_GITHUB_POST_INSTALL_URL=${GAUZY_GITHUB_POST_INSTALL_URL} \
	JITSU_BROWSER_URL=${JITSU_BROWSER_URL} \
	JITSU_BROWSER_WRITE_KEY=${JITSU_BROWSER_WRITE_KEY} \
	FILE_PROVIDER=${FILE_PROVIDER:-"LOCAL"} \
	PLATFORM_PRIVACY_URL=${PLATFORM_PRIVACY_URL:-"https://gauzy.co/privacy"} \
	PLATFORM_TOS_URL=${PLATFORM_TOS_URL:-"https://gauzy.co/tos"} \
	PROJECT_REPO=${PROJECT_REPO:-"https://github.com/DSpotDevelopers/gauzy"} \
	I18N_FILES_URL=${I18N_FILES_URL} \
	COMPANY_NAME=${COMPANY_NAME:-"DSpot sp. z o.o."} \
	COMPANY_LINK=${COMPANY_LINK:-"https://www.dspot.com.pl"} \
	COMPANY_SITE_NAME=${COMPANY_SITE_NAME:-"DSpot ERP"} \
	COMPANY_SITE_LINK=${COMPANY_SITE_LINK:-"https://www.dspot.com.pl"} \
	COMPANY_GITHUB_LINK=${COMPANY_GITHUB_LINK:-"https://github.com/DSpotDevelopers"} \
	COMPANY_GITLAB_LINK=${COMPANY_GITLAB_LINK:-"https://gitlab.com/DSpotDevelopers"} \
	COMPANY_FACEBOOK_LINK=${COMPANY_FACEBOOK_LINK:-"https://www.facebook.com/DSpotTeam"} \
	COMPANY_TWITTER_LINK=${COMPANY_TWITTER_LINK:-"https://x.com/DSpotTeam"} \
	COMPANY_IN_LINK=${COMPANY_IN_LINK:-"https://www.linkedin.com/company/dspotteam"} \
	PLATFORM_WEBSITE_URL=${PLATFORM_WEBSITE_URL:-"https://gauzy.co"} \
	PLATFORM_WEBSITE_DOWNLOAD_URL=${PLATFORM_WEBSITE_DOWNLOAD_URL:-"https://gauzy.co/downloads"} \
	DESKTOP_APP_DOWNLOAD_LINK_APPLE=${DESKTOP_APP_DOWNLOAD_LINK_APPLE:-"https://gauzy.co/downloads#desktop/apple"} \
	DESKTOP_APP_DOWNLOAD_LINK_WINDOWS=${DESKTOP_APP_DOWNLOAD_LINK_WINDOWS:-"https://gauzy.co/downloads#desktop/windows"} \
	DESKTOP_APP_DOWNLOAD_LINK_LINUX=${DESKTOP_APP_DOWNLOAD_LINK_LINUX:-"https://gauzy.co/downloads#desktop/linux"} \
	MOBILE_APP_DOWNLOAD_LINK=${MOBILE_APP_DOWNLOAD_LINK:-"https://gauzy.co/downloads#mobile"} \
	EXTENSION_DOWNLOAD_LINK=${EXTENSION_DOWNLOAD_LINK:-"https://gauzy.co/downloads#extensions"}

EXPOSE ${WEB_PORT}

ENTRYPOINT [ "./entrypoint.prod.sh" ]
CMD [ "nginx", "-g", "daemon off;" ]
