FROM node:buster-slim as linux

RUN mkdir -p /opt/src && chown -R node:node /opt/src && \
    apt update && apt install -y --no-install-recommends \ 
    curl gnupg git libappindicator3-1 ca-certificates binutils \
    icnsutils graphicsmagick

WORKDIR /opt/src

COPY --chown=node:node apps/desktop/package.json ./apps/desktop/
COPY --chown=node:node apps/api/package.json ./apps/api/
COPY --chown=node:node package.json yarn.lock ./

USER node:node

RUN yarn install

COPY --chown=node:node . .

RUN yarn bootstrap

RUN yarn build:desktop:linux

#=========================================================================#

FROM electronuserland/builder:wine as windows

WORKDIR /opt/src

COPY apps/desktop/package.json ./apps/desktop/
COPY apps/api/package.json ./apps/api/
COPY package.json yarn.lock ./
COPY --from=linux /opt/src/node_modules/ ./node_modules
COPY . .

RUN yarn build:desktop:windows

#=========================================================================#

FROM debian:buster-slim

WORKDIR /opt/artifacts

COPY --from=linux /opt/src/dist/apps/desktop-packages ./linux/
COPY --from=windows /opt/src/dist/apps/desktop-packages ./windows/
