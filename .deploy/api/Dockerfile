# devependecies
FROM node:alpine AS dependencies

RUN apk --update add bash && \
    apk add --no-cache dos2unix g++ git make python

RUN mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/api/entrypoint /
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

RUN yarn build:api:prod

# production
FROM node:alpine AS production

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait ./wait
COPY --chown=node:node --from=dependencies /entrypoint .
COPY --chown=node:node apps/api/src/app/core/seeds/data/default-email-templates apps/api/src/app/core/seeds/data/default-email-templates
COPY --chown=node:node --from=build /srv/gauzy/dist/apps/api .

RUN chown node:node wait && chmod +x wait && chown -R node:node apps/
USER node:node

ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production
ENV DB_NAME postgres
ENV API_PORT 3000
ENV DB_PORT 5432

EXPOSE ${API_PORT:-3000}
CMD [ "node", "main.js" ]
ENTRYPOINT [ "./entrypoint" ]