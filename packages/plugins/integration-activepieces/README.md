# ActivePieces Integration Plugin

This plugin provides integration between Ever Gauzy and ActivePieces automation platform using OAuth2.0 authentication and the ActivePieces connection API.

## Overview

The ActivePieces integration allows tenant-level access to ActivePieces from your NestJS application. It implements OAuth2.0 flow and uses ActivePieces' connection API to establish secure connections between your Gauzy application and ActivePieces projects.

## Building

Run `yarn nx build plugin-integration-activepieces` to build the library.

## Running unit tests

Run `yarn nx test plugin-integration-activepieces` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-integration-activepieces`, go to the dist folder `cd dist/packages/plugins/integration-activepieces` and run `npm publish`.

## Installation

Install the Integration ActivePieces Plugin using your preferred package manager:

```shell
npm install @gauzy/plugin-integration-activepieces
# or
  yarn add @gauzy/plugin-integration-activepieces
```
