ARG NODE_OPTIONS
ARG NODE_ENV
ARG API_BASE_URL
ARG CLIENT_BASE_URL
ARG SENTRY_DSN
ARG CLOUDINARY_CLOUD_NAME
ARG CLOUDINARY_API_KEY
ARG GOOGLE_MAPS_API_KEY
ARG GOOGLE_PLACE_AUTOCOMPLETE
ARG DEFAULT_LATITUDE
ARG DEFAULT_LONGITUDE
ARG DEFAULT_CURRENCY
ARG DEMO
ARG API_HOST
ARG API_PORT
ARG HOST
ARG PORT

FROM node:alpine AS dependencies

LABEL maintainer="ever@ever.co"

ENV CI=true

RUN apk --update add bash && \
    apk add --no-cache dos2unix g++ git make python && \
    mkdir /srv/gauzy && chown -R node:node /srv/gauzy

COPY wait .deploy/webapp/entrypoint.compose.sh .deploy/webapp/entrypoint.prod.sh /

RUN chmod +x /wait /entrypoint.compose.sh /entrypoint.prod.sh && dos2unix /entrypoint.compose.sh && dos2unix /entrypoint.prod.sh

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node apps/desktop/package.json ./apps/desktop/
COPY --chown=node:node apps/api/package.json ./apps/api/
COPY --chown=node:node package.json yarn.lock ./

RUN yarn install --frozen-lockfile

FROM node:alpine AS development

USER node:node

WORKDIR /srv/gauzy

COPY --chown=node:node --from=dependencies /wait /entrypoint.compose.sh /entrypoint.prod.sh /
COPY --chown=node:node --from=dependencies /srv/gauzy .
COPY . .

FROM node:alpine AS build

WORKDIR /srv/gauzy

RUN mkdir dist

COPY --chown=node:node --from=development /srv/gauzy .

ENV NODE_OPTIONS=${NODE_OPTIONS:-"--max-old-space-size=2048"}
ENV NODE_ENV=${NODE_ENV:-production}
ENV API_BASE_URL=${API_BASE_URL:-http://localhost:3000}
ENV CLIENT_BASE_URL=${CLIENT_BASE_URL:-http://localhost:4200}
ENV SENTRY_DSN=${SENTRY_DSN}
ENV CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
ENV CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
ENV GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
ENV GOOGLE_PLACE_AUTOCOMPLETE=${GOOGLE_PLACE_AUTOCOMPLETE:-false}
ENV DEFAULT_LATITUDE=${DEFAULT_LATITUDE:-42.6459136}
ENV DEFAULT_LONGITUDE=${DEFAULT_LONGITUDE:-23.3332736}
ENV DEFAULT_CURRENCY=${DEFAULT_CURRENCY:-USD}
ENV DEMO=${DEMO:-false}

ENV IS_DOCKER=true

RUN yarn build:prod

FROM nginx:alpine AS production

# USER nginx:nginx

WORKDIR /srv/gauzy

COPY --chown=nginx:nginx --from=dependencies /wait /entrypoint.compose.sh /entrypoint.prod.sh ./
COPY --chown=nginx:nginx .deploy/webapp/nginx.compose.conf /etc/nginx/conf.d/compose.conf.template
COPY --chown=nginx:nginx .deploy/webapp/nginx.prod.conf /etc/nginx/conf.d/prod.conf.template
COPY --chown=nginx:nginx --from=build /srv/gauzy/dist/apps/gauzy .

RUN chmod +x wait entrypoint.compose.sh entrypoint.prod.sh && \
    chmod a+rw /etc/nginx/conf.d/compose.conf.template /etc/nginx/conf.d/prod.conf.template

ENV API_HOST=${API_HOST:-api}
ENV API_PORT=${API_PORT:-3000}
ENV HOST=${HOST:-0.0.0.0}
ENV PORT=${PORT:-4200}
ENV API_BASE_URL=${API_BASE_URL:-http://localhost:3000}

EXPOSE ${PORT}

ENTRYPOINT [ "./entrypoint.prod.sh" ]

CMD [ "nginx", "-g", "daemon off;" ]
