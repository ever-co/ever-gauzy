# Ever Gauzy Platform UI
#
# Requires BuildKit (Docker 23+/buildx): uses RUN --mount stage bind mounts and build
# secrets so the multi-GB node_modules trees never land in persisted layers (issue #9791).
#
# Build args consumed: NODE_ENV, DEMO, NODE_OPTIONS, NX_BRANCH (build stage only).
# Optional build SECRETS (never pass these as build args — they would be embedded in
# layers and trigger buildx SecretsUsedInArgOrEnv warnings):
#   VERDACCIO_TOKEN       — auth for the packages.ever.co private registry
#   NX_CLOUD_ACCESS_TOKEN — Nx Cloud (currently inert: NX_NO_CLOUD=true below)
# e.g. docker buildx build --secret id=VERDACCIO_TOKEN,env=VERDACCIO_TOKEN ...
#      or the `secrets:` input of docker/build-push-action.
#
# Runtime configuration: the Angular bundle is compiled with DOCKER_* placeholders
# (see .scripts/configure.ts docker branch); at every container start entrypoint.prod.sh
# (or entrypoint.compose.sh) substitutes the CURRENT environment into the JS bundles via
# envsubst + replacements.sed. The ENV literals in the production stage below are the
# load-bearing defaults for that substitution — keep them in sync with replacements.sed.

FROM node:24.16.0-alpine3.23 AS dependencies

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
COPY --chown=node:node packages/plugin-ui/package.json ./packages/plugin-ui/
COPY --chown=node:node packages/ui-react/package.json ./packages/ui-react/
COPY --chown=node:node packages/ui-react-components/package.json ./packages/ui-react-components/
COPY --chown=node:node packages/desktop-ui-lib/package.json ./packages/desktop-ui-lib/
COPY --chown=node:node packages/plugins/integration-ai-ui/package.json ./packages/plugins/integration-ai-ui/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff-ui/package.json ./packages/plugins/integration-hubstaff-ui/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork-ui/package.json ./packages/plugins/integration-upwork-ui/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/integration-github/package.json ./packages/plugins/integration-github/
COPY --chown=node:node packages/plugins/integration-github-ui/package.json ./packages/plugins/integration-github-ui/
COPY --chown=node:node packages/plugins/integration-make-com/package.json ./packages/plugins/integration-make-com/
COPY --chown=node:node packages/plugins/integration-make-com-ui/package.json ./packages/plugins/integration-make-com-ui/
COPY --chown=node:node packages/plugins/integration-zapier-ui/package.json ./packages/plugins/integration-zapier-ui/
COPY --chown=node:node packages/plugins/integration-zapier/package.json ./packages/plugins/integration-zapier/
COPY --chown=node:node packages/plugins/integration-sim/package.json ./packages/plugins/integration-sim/
COPY --chown=node:node packages/plugins/integration-plane/package.json ./packages/plugins/integration-plane/
COPY --chown=node:node packages/plugins/integration-plane-ui/package.json ./packages/plugins/integration-plane-ui/
COPY --chown=node:node packages/plugins/integration-sim-ui/package.json ./packages/plugins/integration-sim-ui/
COPY --chown=node:node packages/plugins/integration-activepieces/package.json ./packages/plugins/integration-activepieces/
COPY --chown=node:node packages/plugins/integration-activepieces-ui/package.json ./packages/plugins/integration-activepieces-ui/
COPY --chown=node:node packages/plugins/jitsu-analytics/package.json ./packages/plugins/jitsu-analytics/
COPY --chown=node:node packages/plugins/sentry-tracing/package.json ./packages/plugins/sentry-tracing/
COPY --chown=node:node packages/plugins/job-search/package.json ./packages/plugins/job-search/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/posthog/package.json ./packages/plugins/posthog/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/
COPY --chown=node:node packages/plugins/job-proposal/package.json ./packages/plugins/job-proposal/
COPY --chown=node:node packages/plugins/job-employee-ui/package.json ./packages/plugins/job-employee-ui/
COPY --chown=node:node packages/plugins/job-matching-ui/package.json ./packages/plugins/job-matching-ui/
COPY --chown=node:node packages/plugins/job-proposal-ui/package.json ./packages/plugins/job-proposal-ui/
COPY --chown=node:node packages/plugins/job-search-ui/package.json ./packages/plugins/job-search-ui/
COPY --chown=node:node packages/plugins/jobs-ui/package.json ./packages/plugins/jobs-ui/
COPY --chown=node:node packages/plugins/legal-ui/package.json ./packages/plugins/legal-ui/
COPY --chown=node:node packages/plugins/maintenance-ui/package.json ./packages/plugins/maintenance-ui/
COPY --chown=node:node packages/plugins/onboarding-ui/package.json ./packages/plugins/onboarding-ui/
COPY --chown=node:node packages/plugins/posthog-ui/package.json ./packages/plugins/posthog-ui/
COPY --chown=node:node packages/plugins/public-layout-ui/package.json ./packages/plugins/public-layout-ui/
COPY --chown=node:node packages/plugins/videos-ui/package.json ./packages/plugins/videos-ui/
COPY --chown=node:node packages/plugins/videos/package.json ./packages/plugins/videos/
COPY --chown=node:node packages/plugins/camshot/package.json ./packages/plugins/camshot/
COPY --chown=node:node packages/plugins/soundshot/package.json ./packages/plugins/soundshot/
COPY --chown=node:node packages/plugins/registry/package.json ./packages/plugins/registry/
COPY --chown=node:node packages/plugins/dashboard-time-track-angular-ui/package.json ./packages/plugins/dashboard-time-track-angular-ui/
COPY --chown=node:node packages/plugins/dashboard-time-track-react-ui/package.json ./packages/plugins/dashboard-time-track-react-ui/
COPY --chown=node:node packages/plugins/ai-chat-react-ui/package.json ./packages/plugins/ai-chat-react-ui/
COPY --chown=node:node packages/ui-core/package.json ./packages/ui-core/
COPY --chown=node:node packages/ui-config/package.json ./packages/ui-config/
COPY --chown=node:node packages/ui-auth/package.json ./packages/ui-auth/

# We do not build here Wakatime plugin, because it used in Desktop Apps for now
# COPY --chown=node:node packages/plugins/integration-wakatime/package.json ./packages/plugins/integration-wakatime/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

# Copy patch-package patches so `yarn postinstall.manual` (patch-package) can apply them.
# Without this, patch-package prints "No patch files found" and the typeorm v1 compat patch is
# never applied. (typeorm is installed here because packages/core/package.json is copied above.)
COPY --chown=node:node patches ./patches

# VERDACCIO_TOKEN arrives as a BuildKit secret (optional; absent file → private registry
# skipped). Registry rewrite, install and .npmrc/.yarnrc cleanup happen in ONE RUN so the
# token never persists in any layer.
# Must be without --production because we need dev deps installed.
RUN --mount=type=secret,id=VERDACCIO_TOKEN,uid=1000 \
	VERDACCIO_TOKEN="$(cat /run/secrets/VERDACCIO_TOKEN 2>/dev/null || true)" && \
	if [ -n "$VERDACCIO_TOKEN" ]; then \
	echo "//packages.ever.co/:_authToken=${VERDACCIO_TOKEN}" >> .npmrc && \
	echo "registry=https://packages.ever.co/" >> .npmrc && \
	echo "always-auth=true" >> .npmrc && \
	echo 'registry "https://packages.ever.co/"' >> .yarnrc && \
	sed -i 's|https://registry.yarnpkg.com|https://packages.ever.co|g' yarn.lock && \
	sed -i 's|https://registry.npmjs.org|https://packages.ever.co|g' yarn.lock; \
	fi && \
	yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts && \
	yarn postinstall.manual && \
	yarn cache clean && \
	rm -f .npmrc .yarnrc

FROM node:24.16.0-alpine3.23 AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.compose.sh /entrypoint.prod.sh /replacements.sed  /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:24.16.0-alpine3.23 AS build

WORKDIR /srv/gauzy

RUN mkdir dist

# Per-package node_modules created by the workspace install in the dependencies stage
# (non-hoisted deps + .bin shims — apps/gauzy/node_modules notably carries the nohoisted
# @angular packages). Node module resolution needs them next to each package/app source.
# These trees are small — unlike the root node_modules, which is bind-mounted below
# instead of being copied into a layer.
COPY --chown=node:node --from=dependencies /srv/gauzy/packages ./packages
COPY --chown=node:node --from=dependencies /srv/gauzy/apps ./apps

# Full source from the build context (root/per-package node_modules and dist are
# .dockerignore'd, so this merges source files over the trees copied above).
COPY --chown=node:node . .

ENV CI=true

# We make NODE_ENV and other env vars passed as build argument to be available in this stage
ARG NODE_ENV
ARG DEMO
ARG NODE_OPTIONS
ARG NX_BRANCH

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=30000"}
ENV NODE_ENV=${NODE_ENV:-production}
ENV DEMO=${DEMO:-false}

ENV IS_DOCKER=true

# The org's Nx Cloud is disabled — do not flip this (builds hard-fail with auth errors).
ENV NX_NO_CLOUD=true
ENV NX_BRANCH=${NX_BRANCH}

# The multi-GB root node_modules is bind-mounted from the dependencies stage for this RUN
# only — it never lands in a persisted layer (this was the main cause of the 44GB+
# build-time disk footprint, see issue #9791). `rw` allows transient cache writes into
# the mount, which are discarded after the step. The @gauzy/* symlinks inside the mount
# resolve to /srv/gauzy/packages|apps on this stage's fs — that is why the source COPYs
# above must happen before this RUN. `yarn run config:*` (ts-node .scripts/configure.ts)
# runs inside this same RUN and writes packages/ui-config environment files to the stage fs.
# The nx local task cache (.nx/cache — NOT disabled by CI=true) is written to the stage
# fs and would duplicate every build output into this layer, so it is deleted in the
# same RUN. (The Angular CLI disk cache IS disabled under CI.)
# NX_CLOUD_ACCESS_TOKEN is an optional build secret (inert while NX_NO_CLOUD=true).
RUN --mount=type=bind,from=dependencies,source=/srv/gauzy/node_modules,target=/srv/gauzy/node_modules,rw \
	--mount=type=secret,id=NX_CLOUD_ACCESS_TOKEN,uid=1000 \
	export NX_CLOUD_ACCESS_TOKEN="$(cat /run/secrets/NX_CLOUD_ACCESS_TOKEN 2>/dev/null || true)" && \
	if [ "$NODE_ENV" = "production" ]; then \
	yarn build:gauzy:prod:docker; \
	else \
	yarn build:gauzy:dev:docker; \
	fi && \
	rm -rf ./.nx

FROM nginx:alpine AS production

# USER nginx:nginx

WORKDIR /srv/gauzy

COPY --chown=nginx:nginx --from=dependencies /wait /entrypoint.compose.sh /entrypoint.prod.sh /replacements.sed ./
COPY --chown=nginx:nginx .deploy/webapp/nginx.compose.conf /etc/nginx/conf.d/compose.conf.template
COPY --chown=nginx:nginx .deploy/webapp/nginx.prod.conf /etc/nginx/conf.d/prod.conf.template
COPY --chown=nginx:nginx --from=build /srv/gauzy/dist/apps/gauzy .

RUN chmod +x wait entrypoint.compose.sh entrypoint.prod.sh && \
	chmod a+rw /etc/nginx/conf.d/compose.conf.template /etc/nginx/conf.d/prod.conf.template

ENV CI=true

# Load-bearing runtime defaults: entrypoint.prod.sh/entrypoint.compose.sh substitute the
# CURRENT environment into the compiled JS bundles (envsubst + replacements.sed) at every
# container start, so these literals are what any deployment gets when it does not set
# the variable itself. They are the SAME values the previous ${X:-default} expansions
# always produced (the build args never reached this stage). Variables with no default
# (SENTRY_DSN, POSTHOG_KEY, CHATWOOT_SDK_TOKEN, GOOGLE_MAPS_API_KEY, ...) used to bake
# empty strings and are now simply unset — identical substitution result, and no more
# secret-named ENV in a public image.
ENV NODE_OPTIONS="--max-old-space-size=12288"
ENV NODE_ENV=production

ENV API_HOST=api
ENV API_PORT=3000

ENV API_BASE_URL=http://localhost:3000
ENV CLIENT_BASE_URL=http://localhost:4200
ENV WEB_HOST=0.0.0.0
ENV WEB_PORT=4200
ENV DEMO=false

ENV POSTHOG_ENABLED=false
ENV POSTHOG_FLUSH_INTERVAL=10000
ENV GOOGLE_PLACE_AUTOCOMPLETE=false
ENV DEFAULT_LATITUDE=42.6459136
ENV DEFAULT_LONGITUDE=23.3332736
ENV DEFAULT_CURRENCY=USD
ENV GAUZY_CLOUD_APP="https://app.gauzy.co"
ENV GAUZY_CLOUD_ENDPOINT="https://api.gauzy.co"
ENV NO_INTERNET_LOGO="assets/images/logos/logo_Gauzy.svg"
ENV FILE_PROVIDER="LOCAL"
ENV PLATFORM_LOGO="assets/images/logos/logo_Gauzy.svg"
ENV GAUZY_DESKTOP_LOGO_512X512="assets/icons/icon_512x512.png"
ENV PLATFORM_PRIVACY_URL="https://gauzy.co/privacy"
ENV PLATFORM_TOS_URL="https://gauzy.co/tos"
ENV PROJECT_REPO="https://github.com/ever-co/ever-gauzy.git"
ENV COMPANY_NAME="Ever Co. LTD"
ENV COMPANY_LINK="https://ever.co"
ENV COMPANY_SITE_NAME="Gauzy"
ENV COMPANY_SITE_LINK="https://gauzy.co"
ENV COMPANY_GITHUB_LINK="https://github.com/ever-co"
ENV COMPANY_GITLAB_LINK="https://gitlab.com/ever-co"
ENV COMPANY_FACEBOOK_LINK="https://www.facebook.com/gauzyplatform"
ENV COMPANY_TWITTER_LINK="https://twitter.com/gauzyplatform"
ENV COMPANY_IN_LINK="https://www.linkedin.com/company/everhq"
ENV PLATFORM_WEBSITE_URL="https://gauzy.co"
ENV PLATFORM_WEBSITE_DOWNLOAD_URL="https://gauzy.co/downloads"
ENV DESKTOP_APP_DOWNLOAD_LINK_APPLE="https://gauzy.co/downloads#desktop/apple"
ENV DESKTOP_APP_DOWNLOAD_LINK_WINDOWS="https://gauzy.co/downloads#desktop/windows"
ENV DESKTOP_APP_DOWNLOAD_LINK_LINUX="https://gauzy.co/downloads#desktop/linux"
ENV MOBILE_APP_DOWNLOAD_LINK="https://gauzy.co/downloads#mobile"
ENV EXTENSION_DOWNLOAD_LINK="https://gauzy.co/downloads#extensions"

EXPOSE ${WEB_PORT}

ENTRYPOINT [ "./entrypoint.prod.sh" ]

CMD [ "nginx", "-g", "daemon off;" ]
