# API

FROM node:alpine AS development

RUN apk update \
    && apk add libexecinfo libexecinfo-dev \
    && npm i -g npm \
    && apk --no-cache add --virtual builds-deps build-base \
    snappy g++ snappy-dev gcc libgcc libstdc++ linux-headers autoconf automake make nasm python git \
    && npm install --quiet node-gyp -g \ 
    && npm config set python /usr/bin/python \
    && npm install yarn@latest -g --force

RUN mkdir /srv/gauzy && chown node:node /srv/gauzy

USER node

WORKDIR /srv/gauzy

COPY --chown=node:node package.json yarn.lock ./
COPY --chown=node:node apps/api/package.json ./apps/api/package.json
# COPY .snyk /tmp/.snyk
RUN yarn install

FROM node:alpine AS production

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.6.0/wait /wait

RUN npm install cross-env -g \
    && npm install pm2 -g --unsafe-perm \
    && chmod +x /wait

RUN mkdir /srv/gauzy && chown node:node /srv/gauzy
RUN mkdir /srv/gauzy/dist && chown node:node /srv/gauzy/dist

USER node

WORKDIR /srv/gauzy

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS $NODE_OPTIONS
ENV NODE_ENV production

COPY --from=development --chown=root:root /srv/gauzy/node_modules ./node_modules
COPY --from=development --chown=root:root /srv/gauzy/apps/api/node_modules ./apps/api/node_modules

COPY . .

EXPOSE 3000

CMD /wait \
    && cross-env NODE_ENV=production NODE_OPTIONS=--max_old_space_size=2048 yarn ng serve api --host 0.0.0.0 -c=production --prod
