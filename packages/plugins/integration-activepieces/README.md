# ActivePieces Integration Plugin

This plugin provides integration between Ever Gauzy and ActivePieces automation platform. It uses the ActivePieces API (authenticated via API key) to manage connections and MCP servers.

## Overview

The ActivePieces integration allows tenant-level management of ActivePieces resources from your NestJS application. It provides:

- **Connection Management** — Create, list, retrieve, and delete ActivePieces app connections for the Ever-gauzy piece
- **MCP Server Management** — List, update, and rotate tokens for ActivePieces MCP servers

All API calls are authenticated using an ActivePieces platform API key (available in Platform/Enterprise editions).

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
