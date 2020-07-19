# devependecies
FROM node:alpine AS dependencies

RUN apk --update add bash && \
    apk add --no-cache dos2unix g++ git make python

RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/webapp/entrypoint /
RUN chmod +x /wait /entrypoint

RUN dos2unix /entrypoint

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

COPY --chown=node:node --from=dependencies /wait /entrypoint /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

# build
FROM node:alpine AS build

WORKDIR /srv/gauzy

RUN mkdir dist

COPY --chown=node:node --from=development /srv/gauzy .

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production

RUN yarn build:prod

# production
FROM nginx:alpine AS production

# USER nginx:nginx

WORKDIR /srv/gauzy

COPY --chown=nginx:nginx --from=dependencies /wait /entrypoint ./
COPY --chown=nginx:nginx .deploy/webapp/nginx.conf /etc/nginx
COPY --chown=nginx:nginx --from=build /srv/gauzy/dist/apps/gauzy .

RUN chmod +x wait

ARG API_BASE_URL=${API_BASE_URL:-http://localhost:3000}
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production
ENV API_PORT 3000

EXPOSE ${PORT:-4200}
CMD [ "nginx", "-g", "daemon off;" ]
ENTRYPOINT [ "./entrypoint" ]
