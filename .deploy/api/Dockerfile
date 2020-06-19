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
COPY wait .deploy/api/entrypoint /
RUN chmod +x /wait /entrypoint
ENTRYPOINT [ "/entrypoint" ]
WORKDIR /opt/app

ENV NODE_OPTIONS --max_old_space_size=4096
ENV NODE_ENV development
ENV DB_NAME postgres
ENV DB_PORT 5432

COPY --from=dependencies /opt/app/ .
COPY . .



#
# build
#
FROM node:alpine AS build
COPY --from=development /opt/app /opt/app
RUN yarn --cwd /opt/app nx build api --configuration=production



#
# production
#
FROM node:alpine AS production
COPY wait .deploy/api/entrypoint /
RUN chmod +x /wait /entrypoint
ENTRYPOINT [ "/entrypoint" ]
CMD [ "node", "main.js" ]
WORKDIR /opt/app-prod

ENV NODE_OPTIONS --max_old_space_size=4096
ENV NODE_ENV production
ENV DB_NAME postgres
ENV DB_PORT 5432

COPY apps/api/src/app/core/seeds/data/default-email-templates apps/api/src/app/core/seeds/data/default-email-templates
COPY --from=dependencies /opt/app/ .
COPY --from=build /opt/app/dist/apps/api .
