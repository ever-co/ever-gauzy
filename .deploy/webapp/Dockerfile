# devependecies
FROM node:alpine AS dependencies

ENV CI=true

RUN apk --update add bash && \
    apk add --no-cache dos2unix g++ git make python && \
    mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/webapp/entrypoint .deploy/webapp/entrypoint.prod.sh /

RUN chmod +x /wait /entrypoint /entrypoint.prod.sh && dos2unix /entrypoint && dos2unix /entrypoint.prod.sh

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/desktop/package.json ./apps/desktop/
COPY --chown=node:node apps/api/package.json ./apps/api/
COPY --chown=node:node package.json yarn.lock ./

RUN yarn install --frozen-lockfile

FROM node:alpine AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint /entrypoint.prod.sh /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:alpine AS build

WORKDIR /srv/gauzy

RUN mkdir dist

COPY --chown=node:node --from=development /srv/gauzy .

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production

RUN yarn build:prod

FROM nginx:alpine AS production

# USER nginx:nginx

WORKDIR /srv/gauzy

COPY --chown=nginx:nginx --from=dependencies /wait /entrypoint /entrypoint.prod.sh ./
COPY --chown=nginx:nginx .deploy/webapp/nginx.conf /etc/nginx/conf.d/default.conf.template
COPY --chown=nginx:nginx --from=build /srv/gauzy/dist/apps/gauzy .

RUN chmod +x wait entrypoint entrypoint.prod.sh && chmod a+rw /etc/nginx/conf.d/default.conf.template

ARG API_BASE_URL=${API_BASE_URL:-http://localhost:3000}
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production
ENV API_PORT 3000

EXPOSE ${PORT:-4200}
ENTRYPOINT [ "./entrypoint.prod.sh" ]
CMD [ "nginx", "-g", "daemon off;" ]
