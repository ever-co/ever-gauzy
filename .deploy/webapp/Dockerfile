#
# devependecies
#
FROM node:alpine AS dependencies
USER node:node
WORKDIR /srv/gauzy

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
FROM node:alpine AS development
USER node:node
WORKDIR /srv/gauzy
ENTRYPOINT [ "/entrypoint" ]
COPY --from=dependencies /wait /entrypoint

ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV API_PORT 3000

COPY --from=dependencies /srv/gauzy .
COPY . .
RUN sed -i -e "s/API_BASE_URL.*;/API_BASE_URL = ${API_BASE_URL};/" \
    apps/gauzy/src/environments/environment.ts


#
# build
#
FROM node:alpine AS build
USER node:node
WORKDIR /srv/gauzy
COPY --from=development /srv/gauzy ./

ARG NODE_OPTIONS="--max-old-space-size=2048"
ARG API_BASE_URL=${API_BASE_URL:-http://localhost:3000}

RUN sed -i -e "s/API_BASE_URL.*;/API_BASE_URL = ${API_BASE_URL};/" \
    apps/gauzy/src/environments/environment.ts

RUN yarn config:prod
RUN yarn nx build gauzy



#
# production
#
FROM nginx:alpine AS production
USER node:node
WORKDIR /srv/gauzy
EXPOSE ${PORT:-4200}
ENTRYPOINT [ "/entrypoint" ]
CMD [ "nginx", "-g", "daemon off;" ]
COPY --from=dependencies /wait /entrypoint

ENV API_PORT 3000

COPY .deploy/webapp/nginx.conf /etc/nginx
COPY --from=build /srv/gauzy/dist/apps/gauzy .
