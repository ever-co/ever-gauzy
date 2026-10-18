# @gauzy/config

This library was generated with [Nx](https://nx.dev). It contains the configuration for the Gauzy API platform.

## Building

Run `nx build config` to build the library.

`nx run config:select-environment --configuration=production` builds the library and then makes the
compiled `environment.js` a copy of `environment.prod.js` (`src/lib/environments/select-compiled-environment.ts`,
run from `dist/`). The API and worker `build` targets depend on `select-environment`, with their own
configuration, which is how `environment.production` is `true` in their production images: the package
is consumed prebuilt, so a `fileReplacements` entry in their own webpack build cannot swap it. The
default (development) configuration puts the development compile back. The source tree is never modified.

## Running unit tests

Run `nx test config` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build config`, go to the dist folder `dist/packages/config` and run `npm publish`.

## Installation

To install the API config Library, simply run the following command in your terminal:

```bash
npm install @gauzy/config
# or
yarn add @gauzy/config
```
