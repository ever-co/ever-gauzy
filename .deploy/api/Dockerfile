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

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV DB_NAME postgres
ENV API_PORT 3000
ENV DB_PORT 5432

COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .



#
# build
#
FROM node:erbium-alpine AS build
COPY --chown=node:node --from=dependencies /app /srv/gauzy
WORKDIR /srv/gauzy
USER node:node

COPY --chown=node:node --from=development /srv/gauzy .

RUN mkdir dist
ARG NODE_OPTIONS="--max-old-space-size=2048"
RUN yarn nx build api --configuration=production



#
# production
#
FROM node:erbium-alpine AS production
COPY --chown=node:node --from=dependencies /wait /entrypoint /
COPY --chown=node:node --from=dependencies /app /srv/gauzy
ENTRYPOINT [ "/entrypoint" ]
CMD [ "node", "main.js" ]
EXPOSE ${API_PORT:-3000}
WORKDIR /srv/gauzy
USER node:node

ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production
ENV DB_NAME postgres
ENV API_PORT 3000
ENV DB_PORT 5432

COPY --chown=node:node apps/api/src/app/core/seeds/data/default-email-templates apps/api/src/app/core/seeds/data/default-email-templates
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY --chown=node:node --from=build /srv/gauzy/dist/apps/api .
