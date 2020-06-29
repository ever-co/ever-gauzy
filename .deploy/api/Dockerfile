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
WORKDIR /srv/gauzy
COPY --from=development /srv/gauzy .
ARG NODE_OPTIONS="--max-old-space-size=2048"
RUN yarn nx build api --configuration=production



#
# production
#
FROM node:alpine AS production
COPY --from=dependencies /wait /entrypoint
ENTRYPOINT [ "/entrypoint" ]
CMD [ "node", "main.js" ]
WORKDIR /srv/gauzy
USER node:node
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
