#
# devependecies
#
FROM node:erbium-alpine AS dependencies
WORKDIR /srv/gauzy
RUN mkdir /app

RUN apk add --no-cache g++ git make python
COPY wait .deploy/webapp/entrypoint /
RUN chmod +x /wait /entrypoint

COPY apps/desktop/package.json ./apps/desktop/
COPY apps/api/package.json ./apps/api/
COPY package.json yarn.lock ./
RUN yarn install


#
# development
#
FROM node:erbium-alpine AS development
COPY --chown=node:node --from=dependencies /wait /entrypoint /
COPY --chown=node:node --from=dependencies /app /srv/gauzy
ENTRYPOINT [ "/entrypoint" ]
WORKDIR /srv/gauzy
USER node:node

ARG API_BASE_URL=${API_BASE_URL:-http://localhost:3000}
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV API_PORT 3000

COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY --chown=node:node . .
RUN sed -i -e "s#API_BASE_URL[^;]\+;#API_BASE_URL = '${API_BASE_URL}';#" \
    apps/gauzy/src/environments/environment.ts


#
# build
#
FROM node:erbium-alpine AS build
COPY --chown=node:node --from=dependencies /app /srv/gauzy
WORKDIR /srv/gauzy
USER node:node

ARG NODE_OPTIONS="--max-old-space-size=2048"
ARG API_BASE_URL=${API_BASE_URL:-http://localhost:3000}

COPY --chown=node:node --from=development /srv/gauzy ./
RUN sed -i -e "s#API_BASE_URL[^;]\+;#API_BASE_URL = '${API_BASE_URL}';#" \
    apps/gauzy/src/environments/environment.ts
#
# I decommend the script because:
#  - it is broken and currently results in en empty file, which is not a module, which breaks the building of the app
#  - it requires seperate mantenance from `environment.ts` file. We shoul not repeat ourselves
#
# RUN yarn config:prod
RUN yarn nx build gauzy



#
# production
#
FROM nginx:alpine AS production
COPY --chown=nginx:nginx --from=dependencies /wait /entrypoint /
COPY --chown=nginx:nginx --from=dependencies /app /srv/gauzy
CMD [ "nginx", "-g", "daemon off;" ]
ENTRYPOINT [ "/entrypoint" ]
EXPOSE ${PORT:-4200}
WORKDIR /srv/gauzy
USER nginx:nginx

ENV API_PORT 3000

COPY --chown=nginx:nginx .deploy/webapp/nginx.conf /etc/nginx
COPY --chown=nginx:nginx --from=build /srv/gauzy/dist/apps/gauzy .
