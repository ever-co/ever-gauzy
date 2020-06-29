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

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV DB_NAME postgres
ENV API_PORT 3000
ENV DB_PORT 5432

COPY --from=dependencies /srv/gauzy .
COPY . .



#
# build
#
FROM node:alpine AS build
USER node:node
WORKDIR /srv/gauzy
COPY --from=development /srv/gauzy .
ARG NODE_OPTIONS="--max-old-space-size=2048"
RUN yarn nx build api --configuration=production



#
# production
#
FROM node:alpine AS production
USER node:node
WORKDIR /srv/gauzy
CMD [ "node", "main.js" ]
ENTRYPOINT [ "/entrypoint" ]
COPY --from=dependencies /wait /entrypoint
EXPOSE 3000

ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production
ENV DB_NAME postgres
ENV API_PORT 3000
ENV DB_PORT 5432

COPY wait /
RUN mkdir dist
RUN chmod +x /wait

COPY apps/api/src/app/core/seeds/data/default-email-templates apps/api/src/app/core/seeds/data/default-email-templates
COPY --from=dependencies /srv/gauzy .
COPY --from=build /srv/gauzy/dist/apps/api .
