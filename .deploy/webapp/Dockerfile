# Webapp

FROM node:alpine AS development
WORKDIR /srv/gauzy
RUN apk add --no-cache g++ git make python


COPY package.json yarn.lock ./
COPY apps/api/package.json ./apps/api/package.json
# COPY .snyk /tmp/.snyk
RUN yarn install

FROM node:alpine AS production

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.6.0/wait /wait

RUN npm install cross-env -g \
    && npm install pm2 -g --unsafe-perm \
    && chmod +x /wait

RUN mkdir /srv/gauzy
RUN mkdir /srv/gauzy/dist

WORKDIR /srv/gauzy
RUN mkdir dist
RUN chown node:node -r .

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS $NODE_OPTIONS
ENV NODE_ENV production

COPY --from=development /srv/gauzy/node_modules ./node_modules

COPY . .

EXPOSE 4200

CMD /wait \
    && cross-env NODE_ENV=production yarn run config:prod \
    && cross-env NODE_ENV=production NODE_OPTIONS=--max_old_space_size=2048 yarn ng serve gauzy --disable-host-check --host 0.0.0.0 -c=production --prod
