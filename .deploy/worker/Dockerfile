# Ever Gauzy Platform Worker
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
# Runtime configuration (DB credentials, JWT secrets, WORKER_* tuning, ...) comes from the
# orchestrator environment (k8s manifests / docker-compose env_file) — it is deliberately
# NOT declared here. Only neutral literal defaults are baked into the image below.
#
# NOTE: every new @gauzy workspace package must be added in THREE places in this file
# (and mirrored in the api/webapp Dockerfiles): the dependencies stage COPY, the
# prod-dependencies stage COPY, and the production stage per-package node_modules copy.

FROM node:24.16.0-alpine3.23 AS dependencies

LABEL maintainer="ever@ever.co"
LABEL org.opencontainers.image.source="https://github.com/ever-co/ever-gauzy"

ENV CI=true

# We need to set to "development", because we are using "yarn install" below to setup
# devDependencies even for production builds!
ENV NODE_ENV=development

# Set Python interpreter for `node-gyp` to use
ENV PYTHON=/usr/bin/python

RUN apk --update add bash && npm i -g npm@9 \
    && apk add --no-cache --virtual build-dependencies bind-tools curl tar xz jq python3 python3-dev py3-configobj py3-pip py3-setuptools build-base \
    snappy libheif dos2unix gcc g++ snappy-dev git libgcc libstdc++ linux-headers autoconf automake make nasm vips-dev vips

# Verify installed versions
RUN node --version && npm --version && python3 --version

RUN npm install --quiet node-gyp@10.2.0 -g && npm install yarn -g --force && npm install --quiet ts-node@10.9.2 -g
RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/worker/entrypoint.prod.sh .deploy/worker/entrypoint.compose.sh /
RUN chmod +x /wait /entrypoint.compose.sh /entrypoint.prod.sh && dos2unix /entrypoint.prod.sh && dos2unix /entrypoint.compose.sh

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/worker/package.json ./apps/worker/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/scheduler/package.json ./packages/scheduler/

# Copy plugins
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/plugins/integration-activepieces/package.json ./packages/plugins/integration-activepieces/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/integration-github/package.json ./packages/plugins/integration-github/
COPY --chown=node:node packages/plugins/integration-jira/package.json ./packages/plugins/integration-jira/
COPY --chown=node:node packages/plugins/integration-make-com/package.json ./packages/plugins/integration-make-com/
COPY --chown=node:node packages/plugins/integration-sim/package.json ./packages/plugins/integration-sim/
COPY --chown=node:node packages/plugins/integration-plane/package.json ./packages/plugins/integration-plane/
COPY --chown=node:node packages/plugins/integration-zapier/package.json ./packages/plugins/integration-zapier/
COPY --chown=node:node packages/plugins/jitsu-analytics/package.json ./packages/plugins/jitsu-analytics/
COPY --chown=node:node packages/plugins/sentry-tracing/package.json ./packages/plugins/sentry-tracing/
COPY --chown=node:node packages/plugins/posthog/package.json ./packages/plugins/posthog/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/videos/package.json ./packages/plugins/videos/
COPY --chown=node:node packages/plugins/camshot/package.json ./packages/plugins/camshot/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/
COPY --chown=node:node packages/plugins/job-search/package.json ./packages/plugins/job-search/
COPY --chown=node:node packages/plugins/job-proposal/package.json ./packages/plugins/job-proposal/
COPY --chown=node:node packages/plugins/soundshot/package.json ./packages/plugins/soundshot/
COPY --chown=node:node packages/plugins/registry/package.json ./packages/plugins/registry/
COPY --chown=node:node packages/plugins/ai-chat/package.json ./packages/plugins/ai-chat/
COPY --chown=node:node packages/plugins/ai-provider-anthropic/package.json ./packages/plugins/ai-provider-anthropic/
COPY --chown=node:node packages/plugins/ai-provider-openai/package.json ./packages/plugins/ai-provider-openai/
COPY --chown=node:node packages/plugins/ai-provider-openrouter/package.json ./packages/plugins/ai-provider-openrouter/
COPY --chown=node:node packages/plugins/ai-provider-vercel-gateway/package.json ./packages/plugins/ai-provider-vercel-gateway/
COPY --chown=node:node packages/plugins/ai-provider-gauzy-ai/package.json ./packages/plugins/ai-provider-gauzy-ai/

# We do not build Wakatime plugin here, because it is used in Desktop Apps for now
# COPY --chown=node:node packages/plugins/integration-wakatime/package.json ./packages/plugins/integration-wakatime/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

# Copy patch-package patches so `yarn postinstall.manual` (patch-package) can apply them.
# Without this, patch-package prints "No patch files found" and the typeorm v1 compat
# patch (string[] relations/select types + runtime shim) is never applied, breaking the build.
COPY --chown=node:node patches ./patches

# VERDACCIO_TOKEN arrives as a BuildKit secret (optional; absent file → private registry
# skipped). Registry rewrite, install and .npmrc/.yarnrc cleanup happen in ONE RUN so the
# token never persists in any layer.
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

FROM node:24.16.0-alpine3.23 AS prod-dependencies

ENV CI=true

# We make NODE_ENV passed as build argument to be available in this stage
ARG NODE_ENV

# Set Python interpreter for `node-gyp` to use
ENV PYTHON=/usr/bin/python

RUN apk --update add bash && npm i -g npm@9 \
    && apk add --no-cache --virtual build-dependencies bind-tools curl tar xz jq python3 python3-dev py3-configobj py3-pip py3-setuptools build-base \
    snappy libheif dos2unix gcc g++ snappy-dev git libgcc libstdc++ linux-headers autoconf automake make nasm vips-dev vips

# Verify installed versions
RUN node --version && npm --version && python3 --version

RUN npm install --quiet node-gyp@10.2.0 -g && npm install yarn -g --force && npm install --quiet ts-node@10.9.2 -g
RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/worker/package.json ./apps/worker/

COPY --chown=node:node packages/common/package.json ./packages/common/
COPY --chown=node:node packages/utils/package.json ./packages/utils/
COPY --chown=node:node packages/config/package.json ./packages/config/
COPY --chown=node:node packages/constants/package.json ./packages/constants/
COPY --chown=node:node packages/contracts/package.json ./packages/contracts/
COPY --chown=node:node packages/auth/package.json ./packages/auth/
COPY --chown=node:node packages/core/package.json ./packages/core/
COPY --chown=node:node packages/scheduler/package.json ./packages/scheduler/

# Copy plugins
COPY --chown=node:node packages/plugin/package.json ./packages/plugin/
COPY --chown=node:node packages/plugins/integration-activepieces/package.json ./packages/plugins/integration-activepieces/
COPY --chown=node:node packages/plugins/integration-ai/package.json ./packages/plugins/integration-ai/
COPY --chown=node:node packages/plugins/integration-hubstaff/package.json ./packages/plugins/integration-hubstaff/
COPY --chown=node:node packages/plugins/integration-upwork/package.json ./packages/plugins/integration-upwork/
COPY --chown=node:node packages/plugins/integration-github/package.json ./packages/plugins/integration-github/
COPY --chown=node:node packages/plugins/integration-jira/package.json ./packages/plugins/integration-jira/
COPY --chown=node:node packages/plugins/integration-make-com/package.json ./packages/plugins/integration-make-com/
COPY --chown=node:node packages/plugins/integration-sim/package.json ./packages/plugins/integration-sim/
COPY --chown=node:node packages/plugins/integration-plane/package.json ./packages/plugins/integration-plane/
COPY --chown=node:node packages/plugins/integration-zapier/package.json ./packages/plugins/integration-zapier/
COPY --chown=node:node packages/plugins/jitsu-analytics/package.json ./packages/plugins/jitsu-analytics/
COPY --chown=node:node packages/plugins/sentry-tracing/package.json ./packages/plugins/sentry-tracing/
COPY --chown=node:node packages/plugins/posthog/package.json ./packages/plugins/posthog/
COPY --chown=node:node packages/plugins/product-reviews/package.json ./packages/plugins/product-reviews/
COPY --chown=node:node packages/plugins/videos/package.json ./packages/plugins/videos/
COPY --chown=node:node packages/plugins/camshot/package.json ./packages/plugins/camshot/
COPY --chown=node:node packages/plugins/knowledge-base/package.json ./packages/plugins/knowledge-base/
COPY --chown=node:node packages/plugins/changelog/package.json ./packages/plugins/changelog/
COPY --chown=node:node packages/plugins/job-search/package.json ./packages/plugins/job-search/
COPY --chown=node:node packages/plugins/job-proposal/package.json ./packages/plugins/job-proposal/
COPY --chown=node:node packages/plugins/soundshot/package.json ./packages/plugins/soundshot/
COPY --chown=node:node packages/plugins/registry/package.json ./packages/plugins/registry/
COPY --chown=node:node packages/plugins/ai-chat/package.json ./packages/plugins/ai-chat/
COPY --chown=node:node packages/plugins/ai-provider-anthropic/package.json ./packages/plugins/ai-provider-anthropic/
COPY --chown=node:node packages/plugins/ai-provider-openai/package.json ./packages/plugins/ai-provider-openai/
COPY --chown=node:node packages/plugins/ai-provider-openrouter/package.json ./packages/plugins/ai-provider-openrouter/
COPY --chown=node:node packages/plugins/ai-provider-vercel-gateway/package.json ./packages/plugins/ai-provider-vercel-gateway/
COPY --chown=node:node packages/plugins/ai-provider-gauzy-ai/package.json ./packages/plugins/ai-provider-gauzy-ai/

# We do not build here Wakatime plugin, because it used in Desktop Apps for now
# COPY --chown=node:node packages/plugins/integration-wakatime/package.json ./packages/plugins/integration-wakatime/

COPY --chown=node:node decorate-angular-cli.js lerna.json package.json yarn.lock ./
COPY --chown=node:node .scripts/postinstall.js ./.scripts/

# Copy patch-package patches so `yarn postinstall.manual` (patch-package) can apply them
# (see note in the dependencies stage above).
COPY --chown=node:node patches ./patches

# VERDACCIO_TOKEN as a BuildKit secret — same single-RUN hygiene as the dependencies stage.
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
    yarn install --network-timeout 1000000 --frozen-lockfile --ignore-scripts --production && \
    yarn postinstall.manual && \
    yarn cache clean && \
    rm -f .npmrc .yarnrc

# We remove Angular modules as it's not used in Workers
RUN rm -r node_modules/@angular

# Exclude @gauzy directories before copying because we copy
# those within custom webpack in apps/worker/config/custom-webpack.config.js
# RUN rm -r node_modules/@gauzy

FROM node:24.16.0-alpine3.23 AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:24.16.0-alpine3.23 AS build

WORKDIR /srv/gauzy

RUN mkdir dist

# Per-package node_modules created by the workspace install in the dependencies stage
# (non-hoisted deps + .bin shims). Node module resolution needs them next to each
# package/app source, and the production stage re-nests packages/*/node_modules under
# node_modules/@gauzy/<pkg>. These trees are small (<1GB total) — unlike the root
# node_modules, which is bind-mounted below instead of being copied into a layer.
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
ENV NODE_ENV=${NODE_ENV}
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
# above must happen before this RUN.
# The nx local task cache (.nx/cache — NOT disabled by CI=true) is written to the stage
# fs and would duplicate every build output into this layer, so it is deleted in the
# same RUN. (The Angular CLI disk cache IS disabled under CI.)
# NX_CLOUD_ACCESS_TOKEN is an optional build secret (inert while NX_NO_CLOUD=true).
RUN --mount=type=bind,from=dependencies,source=/srv/gauzy/node_modules,target=/srv/gauzy/node_modules,rw \
    --mount=type=secret,id=NX_CLOUD_ACCESS_TOKEN,uid=1000 \
    export NX_CLOUD_ACCESS_TOKEN="$(cat /run/secrets/NX_CLOUD_ACCESS_TOKEN 2>/dev/null || true)" && \
    if [ "$NODE_ENV" = "production" ]; then \
    yarn build:worker:prod:docker; \
    else \
    yarn build:worker:dev:docker; \
    fi && \
    rm -rf ./.nx

# Exclude @gauzy directories before copying because we copy
# those within custom webpack in apps/worker/config/custom-webpack.config.js
# RUN rm -r dist/apps/worker/node_modules/@gauzy

FROM node:24.16.0-alpine3.23 AS production

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.prod.sh /entrypoint.compose.sh ./

# NOTE: packages/ is intentionally NOT copied into this stage — the old flow copied it
# and later ran `rm -rf ./packages` (the data still persisted in the layer). The
# node_modules assembly RUN below reads it through a bind mount instead.

# Copy static assets files which used for example in the seeds (e.g. images for features, reports, screenshots)
COPY --chown=node:node apps/worker/src/assets apps/worker/src/assets

# Copy folder to which we later move static assets (e.g. images for features, reports, screenshots)
COPY --chown=node:node apps/worker/public apps/worker/public

# Copy static assets used in seeds (e.g. reports screenshots images, see report.seed.ts) to public folder.
# We are doing it in the seed code too, however if DB seed already was done one time and
# docker container rebuilds, we will not have images unless we copy them during docker build manually here.
COPY --chown=node:node apps/worker/src/assets/seed apps/worker/public

COPY --chown=node:node --from=build /srv/gauzy/dist/apps/worker .

# Assemble the runtime node_modules in a SINGLE layer, reading the source trees through
# bind mounts so they are never duplicated into this image:
#  1. merge the production node_modules from prod-dependencies with cp -rn (no-clobber:
#     the webpack-built @gauzy packages already inside dist/apps/worker/node_modules WIN —
#     this precedence is load-bearing, see custom-webpack.config.js);
#  2. re-nest each workspace package's own node_modules (its non-hoisted deps from the
#     workspace install) under node_modules/@gauzy/<pkg> — required for Node module
#     resolution at runtime. Wakatime plugin is intentionally absent (Desktop Apps only).
RUN --mount=type=bind,from=prod-dependencies,source=/srv/gauzy/node_modules,target=/mnt/prod_node_modules \
    --mount=type=bind,from=build,source=/srv/gauzy/packages,target=/mnt/packages \
    mkdir -p ./node_modules && \
    cp -rn /mnt/prod_node_modules/* ./node_modules/ && \
    cp -r /mnt/packages/auth/node_modules ./node_modules/@gauzy/auth/ && \
    cp -r /mnt/packages/common/node_modules ./node_modules/@gauzy/common/ && \
    cp -r /mnt/packages/utils/node_modules ./node_modules/@gauzy/utils/ && \
    cp -r /mnt/packages/config/node_modules ./node_modules/@gauzy/config/ && \
    cp -r /mnt/packages/contracts/node_modules ./node_modules/@gauzy/contracts/ && \
    cp -r /mnt/packages/core/node_modules ./node_modules/@gauzy/core/ && \
    cp -r /mnt/packages/scheduler/node_modules ./node_modules/@gauzy/scheduler/ && \
    cp -r /mnt/packages/plugins/changelog/node_modules ./node_modules/@gauzy/plugin-changelog/ && \
    cp -r /mnt/packages/plugins/integration-activepieces/node_modules ./node_modules/@gauzy/plugin-integration-activepieces/ && \
    cp -r /mnt/packages/plugins/integration-ai/node_modules ./node_modules/@gauzy/plugin-integration-ai/ && \
    cp -r /mnt/packages/plugins/integration-github/node_modules ./node_modules/@gauzy/plugin-integration-github/ && \
    cp -r /mnt/packages/plugins/integration-hubstaff/node_modules ./node_modules/@gauzy/plugin-integration-hubstaff/ && \
    cp -r /mnt/packages/plugins/integration-jira/node_modules ./node_modules/@gauzy/plugin-integration-jira/ && \
    cp -r /mnt/packages/plugins/integration-make-com/node_modules ./node_modules/@gauzy/plugin-integration-make-com/ && \
    cp -r /mnt/packages/plugins/integration-sim/node_modules ./node_modules/@gauzy/plugin-integration-sim/ && \
    cp -r /mnt/packages/plugins/integration-plane/node_modules ./node_modules/@gauzy/plugin-integration-plane/ && \
    cp -r /mnt/packages/plugins/integration-upwork/node_modules ./node_modules/@gauzy/plugin-integration-upwork/ && \
    cp -r /mnt/packages/plugins/integration-zapier/node_modules ./node_modules/@gauzy/plugin-integration-zapier/ && \
    cp -r /mnt/packages/plugins/jitsu-analytics/node_modules ./node_modules/@gauzy/plugin-jitsu-analytics/ && \
    cp -r /mnt/packages/plugins/job-proposal/node_modules ./node_modules/@gauzy/plugin-job-proposal/ && \
    cp -r /mnt/packages/plugins/job-search/node_modules ./node_modules/@gauzy/plugin-job-search/ && \
    cp -r /mnt/packages/plugins/knowledge-base/node_modules ./node_modules/@gauzy/plugin-knowledge-base/ && \
    cp -r /mnt/packages/plugins/camshot/node_modules ./node_modules/@gauzy/plugin-camshot/ && \
    cp -r /mnt/packages/plugins/product-reviews/node_modules ./node_modules/@gauzy/plugin-product-reviews/ && \
    cp -r /mnt/packages/plugins/sentry-tracing/node_modules ./node_modules/@gauzy/plugin-sentry/ && \
    cp -r /mnt/packages/plugins/posthog/node_modules ./node_modules/@gauzy/plugin-posthog/ && \
    cp -r /mnt/packages/plugins/videos/node_modules ./node_modules/@gauzy/plugin-videos/ && \
    cp -r /mnt/packages/plugins/soundshot/node_modules ./node_modules/@gauzy/plugin-soundshot/ && \
    cp -r /mnt/packages/plugins/registry/node_modules ./node_modules/@gauzy/plugin-registry/ && \
    cp -r /mnt/packages/plugins/ai-chat/node_modules ./node_modules/@gauzy/plugin-ai-chat/ && \
    cp -r /mnt/packages/plugins/ai-provider-anthropic/node_modules ./node_modules/@gauzy/plugin-ai-provider-anthropic/ && \
    cp -r /mnt/packages/plugins/ai-provider-openai/node_modules ./node_modules/@gauzy/plugin-ai-provider-openai/ && \
    cp -r /mnt/packages/plugins/ai-provider-openrouter/node_modules ./node_modules/@gauzy/plugin-ai-provider-openrouter/ && \
    cp -r /mnt/packages/plugins/ai-provider-vercel-gateway/node_modules ./node_modules/@gauzy/plugin-ai-provider-vercel-gateway/ && \
    cp -r /mnt/packages/plugins/ai-provider-gauzy-ai/node_modules ./node_modules/@gauzy/plugin-ai-provider-gauzy-ai/

RUN mkdir /import && chown node:node /import && touch ormlogs.log && chown node:node ormlogs.log && chown node:node wait && \
    chmod +x wait entrypoint.compose.sh entrypoint.prod.sh && chown -R node:node apps/

USER node:node

ENV CI=true

# Neutral runtime defaults baked into the image. These are the SAME literal values the
# previous ${X:-default} expansions always produced (the corresponding build args never
# reached this stage, so every non-defaulted ENV here used to bake an empty string).
# Everything else — DB credentials, JWT/session secrets, mail, storage, integrations —
# must come from the orchestrator's runtime environment (k8s manifests, compose env_file);
# declaring secret-named ARG/ENV here would embed them in a public image and trigger
# buildx SecretsUsedInArgOrEnv warnings.
ENV NODE_OPTIONS="--max-old-space-size=12288"
ENV NODE_ENV=production

ENV API_HOST=api
ENV API_PORT=3000

ENV API_BASE_URL=http://localhost:3000
ENV CLIENT_BASE_URL=http://localhost:4200
ENV SENTRY_HTTP_TRACING_ENABLED=false
ENV SENTRY_PROFILING_ENABLED=false
ENV SENTRY_POSTGRES_TRACKING_ENABLED=false
ENV DB_HOST=db
ENV DB_NAME=postgres
ENV DB_PORT=5432
ENV DB_TYPE=better-sqlite3
ENV DEMO=false
ENV DIGITALOCEAN_S3_FORCE_PATH_STYLE=false

ENV WORKER_DEFAULT_QUEUE=worker-default
ENV WORKER_QUEUE_ENABLED=true
ENV WORKER_SCHEDULER_ENABLED=true

ENTRYPOINT [ "./entrypoint.prod.sh" ]

CMD [ "node", "main.js" ]
