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
COPY --from=development /srv/gauzy .
ARG NODE_OPTIONS="--max-old-space-size=2048"
RUN yarn nx build api --configuration=production



#
# production
#
FROM node:alpine AS production
USER node:node
EXPOSE 3000
RUN mkdir dist
WORKDIR /srv/gauzy

ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production

COPY wait /
RUN chmod +x /wait

COPY apps/api/src/app/core/seeds/data/default-email-templates apps/api/src/app/core/seeds/data/default-email-templates
COPY --from=dependencies /srv/gauzy .
COPY --from=build /srv/gauzy/dist/apps/api .
