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


#
# development
#
FROM node:alpine AS development
USER node:node
WORKDIR /srv/gauzy
COPY --from=dependencies /srv/gauzy .
COPY . .


#
# build
#
FROM node:alpine AS build
WORKDIR /srv/gauzy
COPY --from=development /srv/gauzy ./
ARG NODE_OPTIONS="--max-old-space-size=2048"

RUN yarn config:prod
RUN yarn nx build gauzy



#
# production
#
FROM nginx:alpine AS production
WORKDIR /srv/gauzy
USER node:node
EXPOSE 4200
COPY wait /

RUN chmod +x /wait
COPY .deploy/webapp/nginx.conf /etc/nginx
COPY --from=build /srv/gauzy/dist/apps/gauzy .
