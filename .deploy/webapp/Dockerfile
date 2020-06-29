#
# devependecies
#
FROM node:alpine AS dependencies
RUN apk add --no-cache g++ git make python
COPY wait .deploy/webapp/entrypoint /
RUN chmod +x /wait /entrypoint
WORKDIR /srv/gauzy

COPY apps/desktop/package.json ./apps/desktop/
COPY apps/api/package.json ./apps/api/
COPY package.json yarn.lock ./
RUN yarn install


#
# development
#
FROM node:alpine AS development
COPY --from=dependencies /wait /entrypoint
ENTRYPOINT [ "/entrypoint" ]
WORKDIR /srv/gauzy
USER node:node

ENV API_PORT 3000

COPY --from=dependencies /srv/gauzy .
COPY . .


#
# build
#
FROM node:alpine AS build
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
COPY --from=dependencies /wait /entrypoint
CMD [ "nginx", "-g", "daemon off;" ]
ENTRYPOINT [ "/entrypoint" ]
WORKDIR /srv/gauzy
USER node:node
EXPOSE 4200

ENV API_PORT 3000

COPY .deploy/webapp/nginx.conf /etc/nginx
COPY --from=build /srv/gauzy/dist/apps/gauzy .
