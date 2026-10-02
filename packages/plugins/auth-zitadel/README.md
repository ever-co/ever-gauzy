<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-auth-zitadel",
      "## Switching it on",
      "## Routes",
      "## How it works",
      "## Outbound requests",
      "## Data",
      "## Turning it off",
      "## Build and test"
    ]
  }
}
-->

# @gauzy/plugin-auth-zitadel

Ever ID as an additional way to sign in to Ever Gauzy, built on the shared
OpenID Connect library of `@gauzy/auth`. Ever ID runs on
[ZITADEL](https://zitadel.com); any standard OpenID Provider configured the
same way works too. Every existing sign-in method keeps working exactly as
before.

## Switching it on

Settings on the API (defaults in brackets):

- `ZITADEL_ENABLED` (`false`): `true` loads the plugin. Unset, or any other
  value, leaves it out entirely: no route, no timer, no outbound request.
- `ZITADEL_ISSUERS`: 1-3 issuer URLs, comma-separated; the first is used for
  the sign-in button. https only (http only for `localhost`).
- `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET`: the confidential client
  registered at the issuer.
- `ZITADEL_CALLBACK_URL` (`<API_BASE_URL>/api/auth/zitadel/callback`):
  register this redirect URI at the issuer; sign-in and linking both use it.
- `ZITADEL_ALLOWED_AUDIENCES`: client ids of other first-party apps whose
  tokens `POST /api/auth/zitadel/token` accepts, and whose back-channel
  logout tokens `POST /api/auth/zitadel/backchannel-logout` accepts when
  their server forwards them.
- `ZITADEL_LINK_MODE` (`explicit`): `explicit` connects accounts only from
  Settings. `confirmed` (Ever Cloud only) also connects at sign-in, after
  Gauzy's one-time e-mail code.
- `ZITADEL_SIGNUP_ENABLED` (`false`): Ever Cloud only. A person new to Gauzy
  may create a workspace with Ever ID after confirming it.
- `ZITADEL_BACKCHANNEL_LOGOUT_ENABLED` (`true`): ends the sessions opened
  through Ever ID when the identity provider signs the person out.
- `ZITADEL_HANDOFF_TTL_S` (`60`): lifetime of the one-time sign-in keys, in
  seconds.
- `ZITADEL_CONFIRM_TTL_S` (`1800`): lifetime of pending confirmations, links
  and sign-ups, in seconds.
- `ZITADEL_SCOPES`: requested scopes. Default `openid profile email
  urn:zitadel:iam:user:resourceowner`, plus the project audience scope when
  `EVER_PLATFORM_PROJECT_ID` is set.
- `EVER_INSTALL_SOURCE`: `cloud` only on Ever Cloud. Nothing else is ever
  used to decide that an install is Ever Cloud.

Booleans accept exactly `true` or `false`; any other value is logged once
and the default is used.

On an install that is not Ever Cloud, an issuer on an Ever host is not taken
from `ZITADEL_ISSUERS`: it can only be enabled through Ever Connect, so such
an install never contacts Ever on its own. An issuer on any other host (your
own identity provider) is accepted.

The Ever ID button appears when the web app has `ZITADEL_AUTH_LINK` set (for
example `https://api.example.com/api/auth/zitadel`) **and** the API reports
Ever ID sign-in as enabled. Switch the API on first, check it, then set the
link.

Multi-replica deployments must have Redis configured (`REDIS_ENABLED`), so a
one-time key issued by one replica can be redeemed on another, exactly once.

## Routes

All under `/api/auth/zitadel`:

- `GET /config` (anyone): whether the sign-in is enabled, and which flows
  are on.
- `GET /` (anyone): starts a sign-in (PKCE, `state`, `nonce`; never a login
  hint).
- `GET /callback` (the issuer): returns from the issuer, for sign-in and
  linking.
- `POST /handoff` (anyone): redeems the one-time key of a redirect, once.
- `POST /confirm` (anyone): `confirmed` mode only; completes a link with
  Gauzy's one-time e-mail code (five tries).
- `POST /signup/details`, `POST /signup` (anyone): the Ever Cloud sign-up
  confirmation page and the confirmation itself. The details list the legal
  documents to accept (in the `language` header's language, as `/signup`
  checks them), each with an absolute link to the web app's page for it.
- `POST /token` (first-party apps): exchanges an Ever ID token of an allowed
  client for the workspace list. An access token is accepted only when its
  `aud` names an allowed client. The app may add its `appName`, `appLogo`,
  `appSignature`, `appLink`, `companyName` and `companyLink` (links https
  only) for Gauzy's one-time code e-mail; a link carrying the code is never
  taken from a request.

`/token`, `/confirm`, `/signup/details` and `/signup` accept up to 120
requests a minute per address: another first-party app's server makes them
for everyone signing in through it. `/confirm`, `/signup/details` and
`/signup` also limit each one-time key, to 5, 10 and 5 requests a minute;
over a limit the answer is 429 (with `Retry-After`). While another attempt
uses the same key (a code check or a sign-up still running) they answer 409
`{"code": "handoff_busy", "retryAfter": 2}` with `Retry-After`: the key is
still valid. A used-up or expired key answers 410.
- `POST /link`, `GET /link/start`, `POST /link/preview`,
  `POST /link/confirm` (signed-in user): connect an Ever ID from Settings.
- `DELETE /link/:id`, `GET /identities` (signed-in user): disconnect or list
  this account's Ever IDs.
- `POST /backchannel-logout` (the issuer): OpenID Connect back-channel
  logout.

While the plugin is loaded but not configured, every route except `/config`
answers 404 and no outbound request is made.

## How it works

- **Sign-in.** After the issuer confirms the person, the plugin looks up the
  Gauzy users linked to that Ever ID and hands the browser an opaque one-time
  key. The web app redeems it for the workspace list and signs in through
  the unchanged `POST /api/auth/signin.workspace`. No token, e-mail address
  or other personal data is ever put in a URL. Gauzy's own access and
  refresh tokens are issued exactly as for the e-mail code sign-in. The
  workspace tokens in the list are valid for 15 minutes (the window in which
  the sign-in is bound to its Ever ID session, see back-channel logout).
- **Team lists.** When a link is confirmed with Gauzy's code for another
  first-party app (`/confirm` with a key from `/token`), each workspace
  carries the team list Gauzy's own code check returns (`current_teams`), as
  Gauzy's e-mail code sign-in does for that app. The other answers carry
  none: the plugin makes no team lookups of its own.
- **No silent linking, no silent accounts.** An e-mail match alone never
  connects an Ever ID to an account and never creates one. A person without
  a link is sent to Gauzy's register page (prefilled), or, in `confirmed`
  mode, proves the mailbox with Gauzy's own one-time code first.
- **Linking from Settings.** Settings > Connected identities asks the
  signed-in person to sign in to Ever ID again (a fresh login, at most five
  minutes old, with a verified e-mail) and to confirm on a screen that shows
  both addresses. Accounts with the same address in other workspaces are
  linked only when ticked and proved with Gauzy's one-time code.
- **Ever Cloud sign-up.** With `ZITADEL_SIGNUP_ENABLED=true` on Ever Cloud, a
  person new to Gauzy is offered "Create a Gauzy workspace with this Ever
  ID". Nothing is created until they confirm; then Gauzy's own register path
  runs behind its own subscription check. Without a subscription the
  confirmed sign-up waits on the server (keyed to the Ever ID, for
  `ZITADEL_CONFIRM_TTL_S`) while the person goes through checkout, and
  finishes the next time they sign in with Ever ID. A sign-up whose account
  was created but not linked (a step failed) also finishes then, without a
  new code. One sign-up runs at a time per Ever ID, so two tabs never create
  two accounts. The account starts without a workspace (tenant), as with
  Gauzy's register page: its workspace token signs in to it, and the app
  then sets the workspace up.
- **Organization rules.** Optional hints in the ID token can remove a
  workspace from a sign-in (for example an organization that requires its
  company sign-in); they never grant access.
- **Back-channel logout.** Each Gauzy session opened through Ever ID is bound
  to the refresh token of its sign-in. When the identity provider reports
  that session ended (or, for a token naming only a subject, every session
  of that person), that refresh token and the ones rotated from it are
  revoked, so the session cannot be renewed; sessions opened some other way
  keep working. Access tokens already issued stay valid until they expire
  (`JWT_TOKEN_EXPIRATION_TIME`), because Gauzy checks them by signature. A
  logout token is accepted once and only while fresh; when the sessions
  cannot be ended the answer is 503, so the identity provider can retry.
  Another first-party app listed in `ZITADEL_ALLOWED_AUDIENCES` may forward
  the logout token it received (it names that app as its audience); it
  passes exactly the same checks and ends the same sessions.

## Outbound requests

Only the configured issuer's discovery document, key set and token endpoint:
discovery and token requests while someone signs in, and the key set also to
check a back-channel logout token or a first-party token (all cached). None
while the plugin is off or unconfigured, and none at start. Issuers must use
https (http only on the local machine).

## Data

Four tables, created by the core migration listed in `MIGRATIONS.md`:

- `zitadel_account`: links;
- `zitadel_organization`: organization links;
- `zitadel_session`: sessions opened through Ever ID;
- `zitadel_logout_jti`: the logout token replay cache.

Ever ID tokens are never stored. Deleting a Gauzy user deletes that user's
links and session records with it (foreign keys with `ON DELETE CASCADE`).

## Turning it off

1. Unset `ZITADEL_AUTH_LINK` in the web app: the button disappears.
2. Set `ZITADEL_ENABLED=false` (or unset it): the routes answer 404 and the
   plugin is not loaded. Sessions already open keep working; the tables
   stay.
3. Only to remove the tables: `yarn migration:revert` for the migration in
   `MIGRATIONS.md`.

## Build and test

```bash
yarn nx build plugin-auth-zitadel
yarn nx test plugin-auth-zitadel
```
