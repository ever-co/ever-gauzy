<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-auth-keycloak",
      "## Switching it on",
      "## What it adds",
      "## How sign-in works",
      "## Turning it off",
      "## Build and test"
    ]
  }
}
-->

# @gauzy/plugin-auth-keycloak

Keycloak as an additional way to sign in to Ever Gauzy. Every existing
sign-in method keeps working exactly as before.

## Switching it on

The plugin is loaded only when all of these are set on the API:

- `KEYCLOAK_ENABLED`: `true` loads the plugin. Anything else (or unset)
  leaves it out entirely.
- `KEYCLOAK_CLIENT_ID`, `KEYCLOAK_CLIENT_SECRET`: the confidential client of
  your realm.
- `KEYCLOAK_AUTH_SERVER_URL`: the Keycloak base URL (for example
  `https://id.example.com` or `.../auth`).
- `KEYCLOAK_REALM`: the realm. The issuer is
  `<KEYCLOAK_AUTH_SERVER_URL>/realms/<KEYCLOAK_REALM>` and must use https
  (http only on the local machine).
- `KEYCLOAK_CALLBACK_URL` (optional): defaults to
  `<API_BASE_URL>/api/auth/keycloak/callback`.

The `KEYCLOAK_*` names are the ones Gauzy has always used. The sample
placeholder `XXXXXXX` never counts as configured.

The login button appears when the web app also has `KEYCLOAK_AUTH_LINK` set
(for example `https://api.example.com/api/auth/keycloak`) **and** the API
reports the plugin as enabled. Enable the API side first, check it, then set
the link.

## What it adds

- `GET /api/auth/keycloak/config`: `{ "enabled": true }` for the login page.
- `GET /api/auth/keycloak`: starts a sign-in; redirects to the realm's
  authorize endpoint.
- `GET /api/auth/keycloak/callback`: Keycloak redirects back here.

With the plugin off these paths answer 404, the login page shows no Keycloak
button and the API makes no request to Keycloak.

## How sign-in works

The authorization code flow runs with PKCE, `state` and `nonce` (kept in a
short-lived signed `HttpOnly` cookie), using the shared OpenID Connect
library of `@gauzy/auth`. The ID token is verified against the realm's
published keys. Only an e-mail address Keycloak reports as verified is used:
it signs the person in to the Gauzy account that owns that address, through
the same path the Google, GitHub and Microsoft sign-ins use. An address
without a Gauzy account goes to the register page; nothing is created
automatically.

Keycloak must publish its OpenID configuration at
`<issuer>/.well-known/openid-configuration` with that exact `issuer`, and
its endpoints on the same origin. Request the `email` scope for the client.

The Keycloak passport strategy and guard that used to sit in `@gauzy/auth`
now live in this package, unchanged.

## Turning it off

Unset `KEYCLOAK_AUTH_LINK` (the button disappears), then set
`KEYCLOAK_ENABLED=false` or unset it (the routes disappear). Nothing is
stored by this plugin.

## Build and test

```bash
yarn nx build plugin-auth-keycloak
yarn nx test plugin-auth-keycloak
```
