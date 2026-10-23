# @gauzy/config

This library was generated with [Nx](https://nx.dev). It contains the configuration for the Gauzy API platform.

## Building

Run `nx build config` to build the library.

### Development and production environment

`src/lib/environments/environment.ts` (development) and `environment.prod.ts`
(production) are both compiled. The package is consumed prebuilt — the API and
worker externalize `@gauzy/*` and copy `dist/packages/config` into their own
`node_modules` — so a `fileReplacements` entry in their webpack builds cannot
swap the two. The compiled file is selected instead
(`src/lib/environments/select-compiled-environment.ts`, used from `dist/`):

- A production build of the API or worker writes the production file as
  `environment.js` while copying the package into its own `node_modules`
  (`apps/api/config/webpack-package-copy-patterns.js`). `dist/packages/config`
  itself is left alone, so builds with different configurations never
  interfere.
- `nx run config:select-environment --configuration=production` (the
  `lib:build:prod` script) makes `dist/packages/config` itself a production
  dist, for publishing; the default configuration puts the development
  compile back.

The source tree is never modified.

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
