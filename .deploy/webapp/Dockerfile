# devependecies
FROM node:alpine AS dependencies

RUN apk update \
    && apk add --no-cache g++ git make python

RUN mkdir /srv/gauzy && chown node:node /srv/gauzy

COPY wait .deploy/webapp/entrypoint /
RUN chmod +x /wait /entrypoint

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/desktop/package.json ./apps/desktop/
COPY --chown=node:node apps/api/package.json ./apps/api/
COPY --chown=node:node package.json yarn.lock ./

RUN yarn install

# development
FROM node:alpine AS development

USER node:node

WORKDIR /srv/gauzy

ENTRYPOINT [ "/entrypoint" ]

ENV NODE_OPTIONS="--max-old-space-size=2048"

ENV API_PORT 3000

COPY --chown=node:node --from=dependencies /wait /entrypoint /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

# build
FROM node:alpine AS build

WORKDIR /srv/gauzy

RUN mkdir dist

COPY --chown=node:node --from=development /srv/gauzy .

ARG NODE_OPTIONS="--max-old-space-size=2048"
ARG API_BASE_URL=${API_BASE_URL:-http://localhost:3000}

RUN yarn build:prod

# production
FROM nginx:alpine AS production

COPY wait /
RUN chmod +x /wait

USER node:node

WORKDIR /srv/gauzy

COPY --from=dependencies /wait /entrypoint /

EXPOSE ${PORT:-4200}
CMD [ "nginx", "-g", "daemon off;" ]
ENTRYPOINT [ "/entrypoint" ]

ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production
ENV API_PORT 3000

COPY .deploy/webapp/nginx.conf /etc/nginx
COPY --from=build /srv/gauzy/dist/apps/gauzy .
