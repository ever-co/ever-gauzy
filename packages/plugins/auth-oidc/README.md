<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-auth-oidc",
      "## Switching it on",
      "## Provider requirements",
      "## What it adds",
      "## How sign-in works",
      "## Turning it off",
      "## Build and test"
    ]
  }
}
-->

# @gauzy/plugin-auth-oidc

Sign-in with any standards-compliant OpenID Connect provider (Authentik,
Authelia, Zitadel, Casdoor, Ory Hydra, Keycloak and others) as an additional
way to sign in to Ever Gauzy. Every existing sign-in method keeps working
exactly as before.

## Switching it on

The plugin is loaded only when all of these are set on the API:

- `OIDC_ENABLED`: `true` loads the plugin. Anything else (or unset) leaves it
  out entirely.
- `OIDC_ISSUER`: the provider's issuer identifier, exactly as its discovery
  document publishes it (some providers, Authentik for one, end it with a
  slash). It must use https (http only on the local machine).
- `OIDC_CLIENT_ID`: the confidential client registered for Gauzy.
- `OIDC_CLIENT_SECRET`: its secret.

Optional:

- `OIDC_SCOPES`: requested scopes, separated by spaces or commas. Default
  `openid email profile`; `openid` is always requested.
- `OIDC_CALLBACK_URL`: defaults to `<API_BASE_URL>/api/auth/oidc/callback`.
- `OIDC_DISPLAY_NAME`: the name on the login button ("Sign in with ...").
  Default `SSO`, at most 40 characters.

The sample placeholder `XXXXXXX` never counts as configured. When the switch
is on but a required setting is missing or refused, the API logs which
setting (never its value) and leaves the plugin out.

The login button appears when the web app also has `OIDC_AUTH_LINK` set (for
example `https://api.example.com/api/auth/oidc`) **and** the API reports the
plugin as enabled. Enable the API side first, check it, then set the link.

## Provider requirements

Register Gauzy at the provider as a confidential web client:

- grant type authorization code, with PKCE (`S256`);
- redirect URI: the callback URL above;
- client authentication `client_secret_basic`;
- scopes `openid email profile` (or what `OIDC_SCOPES` lists).

The provider must publish its OpenID configuration at
`<issuer>/.well-known/openid-configuration` with that exact `issuer`, keep
the endpoints it lists (authorize, token, key set, userinfo) on the issuer's
own origin, sign ID tokens with `RS256`, `ES256` or `EdDSA`, and report the
person's address with `email_verified: true`: in the ID token, or, when the ID
token carries no address (Zitadel and Authelia leave it out by default), from
its userinfo endpoint, whose answer counts only for the ID token's own
subject. A provider whose key set lives on another host, or that does not
report verified addresses, cannot be used with this plugin.

## What it adds

- `GET /api/auth/oidc/config`: `{ "enabled": true, "displayName": "SSO" }`
  for the login page.
- `GET /api/auth/oidc`: starts a sign-in; redirects to the provider's
  authorize endpoint.
- `GET /api/auth/oidc/callback`: the provider redirects back here.

With the plugin off these paths answer 404, the login page shows no button
and the API makes no request to the provider.

## How sign-in works

The authorization code flow runs with PKCE, `state` and `nonce` (kept in a
short-lived signed `HttpOnly` cookie), using the shared OpenID Connect
library of `@gauzy/auth` (the same flow the Keycloak plugin runs). The ID
token is verified against the provider's published keys. Only an e-mail
address the provider reports as verified is used: it signs the person in to
the Gauzy account that owns that address, through the same path the Google,
GitHub and Microsoft sign-ins use. When several workspaces match, the
workspace picker opens. An address without a Gauzy account goes to the
register page; nothing is created automatically.

## Turning it off

Unset `OIDC_AUTH_LINK` (the button disappears), then set
`OIDC_ENABLED=false` or unset it (the routes disappear). Nothing is stored by
this plugin.

## Build and test

```bash
yarn nx build plugin-auth-oidc
yarn nx test plugin-auth-oidc
```
