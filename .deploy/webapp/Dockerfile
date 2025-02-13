# Ever Gauzy Platform UI

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
ARG NO_INTERNET_LOGO
ARG FILE_PROVIDER
ARG PLATFORM_LOGO
ARG GAUZY_DESKTOP_LOGO_512X512
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

FROM node:20.11.1-alpine3.19 AS builder

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

# We make NODE_ENV and other env vars passed as build argument to be available in this stage
ARG NODE_ENV
ARG DEMO
ARG NODE_OPTIONS

ENV CI=true \
	NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=60000"} \
	NODE_ENV=${NODE_ENV:-production} \
	DEMO=${DEMO:-false} \
	IS_DOCKER=true \
	NX_NO_CLOUD=true

RUN apk --update add bash \
	&& npm i -g npm@9 yarn --force \
	&& mkdir /srv/gauzy \
	&& chown -R node:node /srv/gauzy \
	&& rm -rf /var/cache/apk/*

COPY --chmod=755 wait .deploy/webapp/entrypoint.compose.sh .deploy/webapp/entrypoint.prod.sh .deploy/webapp/replacements.sed /

USER node:node
WORKDIR /srv/gauzy

COPY --chown=node:node . .

# Must be without --production because we need dev deps installed
RUN NODE_ENV=development yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts \
	&& yarn postinstall.manual \
	&& yarn cache clean

# RUN yarn build:package:gauzy:docker
RUN yarn build:gauzy:prod:docker \
	&& rm -rf ./node_modules \
	&& yarn cache clean

FROM nginx:alpine AS production

WORKDIR /srv/gauzy

COPY --chown=nginx:nginx --from=builder /wait /entrypoint.compose.sh /entrypoint.prod.sh /replacements.sed ./
COPY --chown=nginx:nginx .deploy/webapp/nginx.compose.conf /etc/nginx/conf.d/compose.conf.template
COPY --chown=nginx:nginx .deploy/webapp/nginx.prod.conf /etc/nginx/conf.d/prod.conf.template
COPY --chown=nginx:nginx --from=builder /srv/gauzy/dist/apps/gauzy .

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
	NO_INTERNET_LOGO=${NO_INTERNET_LOGO:-"assets/images/logos/logo_Gauzy.svg"} \
	FILE_PROVIDER=${FILE_PROVIDER:-"LOCAL"} \
	PLATFORM_LOGO=${PLATFORM_LOGO:-"assets/images/logos/logo_Gauzy.svg"} \
	GAUZY_DESKTOP_LOGO_512X512=${GAUZY_DESKTOP_LOGO_512X512:-"assets/icons/icon_512x512.png"} \
	PLATFORM_PRIVACY_URL=${PLATFORM_PRIVACY_URL:-"https://gauzy.co/privacy"} \
	PLATFORM_TOS_URL=${PLATFORM_TOS_URL:-"https://gauzy.co/tos"} \
	PROJECT_REPO=${PROJECT_REPO:-"https://github.com/ever-co/ever-gauzy.git"} \
	I18N_FILES_URL=${I18N_FILES_URL} \
	COMPANY_NAME=${COMPANY_NAME:-"Ever Co. LTD"} \
	COMPANY_LINK=${COMPANY_LINK:-"https://ever.co"} \
	COMPANY_SITE_NAME=${COMPANY_SITE_NAME:-"Gauzy"} \
	COMPANY_SITE_LINK=${COMPANY_SITE_LINK:-"https://gauzy.co"} \
	COMPANY_GITHUB_LINK=${COMPANY_GITHUB_LINK:-"https://github.com/ever-co"} \
	COMPANY_GITLAB_LINK=${COMPANY_GITLAB_LINK:-"https://gitlab.com/ever-co"} \
	COMPANY_FACEBOOK_LINK=${COMPANY_FACEBOOK_LINK:-"https://www.facebook.com/gauzyplatform"} \
	COMPANY_TWITTER_LINK=${COMPANY_TWITTER_LINK:-"https://twitter.com/gauzyplatform"} \
	COMPANY_IN_LINK=${COMPANY_IN_LINK:-"https://www.linkedin.com/company/everhq"} \
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
