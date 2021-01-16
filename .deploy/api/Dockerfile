FROM node:alpine AS dependencies

ENV CI=true

RUN apk --update add bash && \
    apk add --no-cache dos2unix g++ git make python vips-dev && \
    mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/api/entrypoint.sh /
RUN chmod +x /wait /entrypoint.sh && dos2unix /entrypoint.sh

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/desktop/package.json ./apps/desktop/
COPY --chown=node:node apps/api/package.json ./apps/api/
COPY --chown=node:node package.json yarn.lock ./

RUN yarn install --frozen-lockfile

FROM node:alpine AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.sh /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:alpine AS build

WORKDIR /srv/gauzy

RUN mkdir dist

COPY --chown=node:node --from=development /srv/gauzy .

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production

RUN yarn build:api:prod

FROM node:alpine AS production

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait ./wait
COPY --chown=node:node --from=dependencies /entrypoint.sh .
COPY --chown=node:node --from=dependencies /srv/gauzy/node_modules ./node_modules/
COPY --chown=node:node apps/api/src/app/core/seeds/data/default-email-templates apps/api/src/app/core/seeds/data/default-email-templates
COPY --chown=node:node apps/api/src/assets apps/api/src/assets
COPY --chown=node:node --from=build /srv/gauzy/dist/apps/api .

RUN npm install pm2 -g && mkdir /import && chown node:node /import && \
    touch ormlogs.log && chown node:node ormlogs.log && chown node:node wait && \
    chmod +x wait && chown -R node:node apps/
    
USER node:node

ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_ENV production
ENV DB_NAME postgres
ENV API_PORT 3000
ENV DB_PORT 5432

EXPOSE ${API_PORT:-3000}
CMD [ "pm2-runtime", "main.js" ]
