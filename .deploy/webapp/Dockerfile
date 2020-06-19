#
# devependecies
#
FROM node:alpine AS dependencies
RUN apk add --no-cache --virtual .gyp g++ git make python

COPY apps/desktop/package.json apps/desktop/yarn[.]lock /opt/app/apps/desktop/
COPY apps/api/package.json apps/api/yarn[.]lock /opt/app/apps/api/
COPY package.json yarn[.]lock /opt/app/

RUN yarn --cwd /opt/app install
RUN apk del .gyp



#
# development
#
FROM node:alpine AS development
COPY wait .deploy/webapp/entrypoint /
RUN chmod +x /wait /entrypoint
ENTRYPOINT [ "/entrypoint" ]
WORKDIR /opt/app

ENV NODE_OPTIONS --max_old_space_size=4096
ENV NODE_ENV development
ENV API_PORT 3000

COPY --from=dependencies /opt/app/ .
COPY . .



#
# build
#
FROM node:alpine AS build
COPY --from=development /opt/app /opt/app
RUN sed -i -e "s/let API_BASE_URL = [^;]*;/let API_BASE_URL = \`$\{ location.host }\/api\`;/g" \
    /opt/app/apps/gauzy/src/environments/environment.ts
RUN yarn --cwd /opt/app nx build gauzy



#
# production
#
FROM nginx:alpine AS production
COPY wait .deploy/webapp/entrypoint /
CMD [ "nginx", "-g", "daemon off;" ]
RUN chmod +x /wait /entrypoint
ENTRYPOINT [ "/entrypoint" ]
WORKDIR /opt/app-prod
ENV API_PORT 3000

COPY .deploy/webapp/nginx.conf /etc/nginx
COPY --from=build /opt/app/dist/apps/gauzy .
