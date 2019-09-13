# Webapp

FROM node:alpine

RUN apk update

RUN npm i -g npm

RUN apk add libexecinfo libexecinfo-dev

RUN apk --no-cache add --virtual builds-deps build-base \
  snappy g++ snappy-dev gcc libgcc libstdc++ linux-headers autoconf automake make nasm python git && \
  npm install --quiet node-gyp -g

RUN npm config set python /usr/bin/python

RUN npm install yarn -g

RUN npm install cross-env -g

RUN npm install pm2 -g --unsafe-perm

# Make our app folder (empty for now)
RUN mkdir -p /usr/src/app

# Provides cached layer for node_modules and bower_components
COPY package.json /tmp/package.json
# COPY .snyk /tmp/.snyk
COPY yarn.lock /tmp/yarn.lock
RUN cd /tmp/ && yarn install
RUN cp -a /tmp/node_modules /usr/src/app/
RUN cd /usr/src/app

WORKDIR /usr/src/app
ARG NODE_OPTIONS="--max-old-space-size=2048"
ENV NODE_OPTIONS $NODE_OPTIONS
ENV NODE_ENV production

# Bundle app source
ADD . /usr/src/app

EXPOSE 4200

ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.6.0/wait /wait
RUN chmod +x /wait

CMD /wait && cross-env NODE_ENV=production NODE_OPTIONS=--max_old_space_size=2048 yarn run config:prod && yarn ng serve gauzy --disable-host-check --host 0.0.0.0 -c=production --prod
