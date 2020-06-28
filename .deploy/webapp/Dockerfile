#
# devependecies
#
FROM node:alpine AS dependencies
RUN apk add --no-cache \
    g++ git make python
WORKDIR /srv/gauzy

COPY apps/desktop/package.json ./apps/desktop/
COPY apps/api/package.json ./apps/api/
COPY package.json yarn.lock ./
RUN yarn install



FROM node:alpine AS development
WORKDIR /srv/gauzy
COPY --from=dependencies /srv/gauzy .



FROM node:alpine AS production
EXPOSE 4200
COPY wait /
RUN mkdir dist
WORKDIR /srv/gauzy

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS $NODE_OPTIONS
ENV NODE_ENV production

RUN chown node:node -r .
RUN chmod +x /wait

COPY --from=development /srv/gauzy/node_modules ./node_modules
COPY . .

CMD /wait \
    && cross-env NODE_ENV=production yarn run config:prod \
    && cross-env NODE_ENV=production NODE_OPTIONS=--max_old_space_size=2048 yarn ng serve gauzy --disable-host-check --host 0.0.0.0 -c=production --prod
