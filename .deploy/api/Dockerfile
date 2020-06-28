# API
FROM node:alpine AS development
USER node
WORKDIR /srv/gauzy
RUN chown -r node:node .
RUN apk add --no-cache g++ git make python

COPY --chown=node:node apps/api/package.json ./apps/api/package.json
COPY --chown=node:node package.json yarn.lock ./
RUN yarn install



FROM node:alpine AS production
USER node
EXPOSE 3000
RUN mkdir dist
WORKDIR /srv/gauzy

ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS $NODE_OPTIONS
ENV NODE_ENV production

COPY wait /
RUN chmod +x /wait
RUN chown node:node -r .

COPY --from=development --chown=root:root /srv/gauzy/node_modules ./node_modules
COPY --from=development --chown=root:root /srv/gauzy/apps/api/node_modules ./apps/api/node_modules

COPY . .
CMD /wait \
    && cross-env NODE_ENV=production NODE_OPTIONS=--max_old_space_size=2048 yarn ng serve api --host 0.0.0.0 -c=production --prod
