# @gauzy/auth

This library was generated with [Nx](https://nx.dev). It contains the authentication for the Gauzy API platform.

## Overview

This library provides a set of services and utilities for authentication and authorization in the Gauzy API platform.

## Building

Run `nx build auth` to build the library.

## Running unit tests

Run `nx test auth` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build auth`, go to the dist folder `dist/packages/auth` and run `npm publish`.

## Installation

To install the API auth Library, simply run the following command in your terminal:

```bash
npm install @gauzy/auth
# or
yarn add @gauzy/auth
```

## OpenID Connect client library

`src/lib/oidc` is a small OpenID Connect client (discovery, key sets, PKCE, a signed-cookie
transaction for `state` / `nonce`, the authorization code exchange, ID token and back-channel
logout token validation). It is registered nowhere and knows no identity provider: a sign-in
plugin imports `OidcModule` and passes its own issuer settings. Without such a plugin it does
nothing and makes no outbound request. Only the configured issuer's own endpoints are ever called,
and only asymmetric signatures (`RS256`, `ES256`, `EdDSA`) are accepted.

## Provider plugins

Additional sign-in methods live in plugins that build on this package rather than inside it:

-   `@gauzy/plugin-auth-keycloak` (`packages/plugins/auth-keycloak`): Keycloak sign-in. The Keycloak
    passport strategy and guard moved there unchanged; `KEYCLOAK_*` settings keep their names.
-   `@gauzy/plugin-auth-zitadel` (`packages/plugins/auth-zitadel`): Ever ID sign-in.

Both are off unless an operator switches them on (`KEYCLOAK_ENABLED`, `ZITADEL_ENABLED`); see each
plugin's README.
