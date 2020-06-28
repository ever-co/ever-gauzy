# API

FROM node:alpine AS development

RUN apk add --no-cache g++ git make python

WORKDIR /srv/gauzy
RUN chown node:node /srv/gauzy
USER node


COPY --chown=node:node package.json yarn.lock ./
COPY --chown=node:node apps/api/package.json ./apps/api/package.json
RUN yarn install

FROM node:alpine AS production

COPY wait /

RUN chmod +x /wait

WORKDIR /srv/gauzy
USER node
RUN mkdir -p dist
RUN chown node:node -r .

WORKDIR /srv/gauzy

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS $NODE_OPTIONS
ENV NODE_ENV production

COPY --from=development --chown=root:root /srv/gauzy/node_modules ./node_modules
COPY --from=development --chown=root:root /srv/gauzy/apps/api/node_modules ./apps/api/node_modules

COPY . .

EXPOSE 3000

CMD /wait \
    && cross-env NODE_ENV=production NODE_OPTIONS=--max_old_space_size=2048 yarn ng serve api --host 0.0.0.0 -c=production --prod
