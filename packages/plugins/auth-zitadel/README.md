# @gauzy/plugin-auth-zitadel

Ever ID as an additional way to sign in to Ever Gauzy, built on the shared OpenID Connect library of
`@gauzy/auth`. Ever ID runs on [ZITADEL](https://zitadel.com); any standard OpenID Provider configured
the same way works too. Every existing sign-in method keeps working exactly as before.

## Switching it on

| Variable                               | Default    | Meaning                                                                                                                                                             |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ZITADEL_ENABLED`                      | `false`    | `true` loads the plugin. Unset (or anything else) leaves it out entirely: no route, no timer, no outbound request.                                                 |
| `ZITADEL_ISSUERS`                      |            | 1-3 issuer URLs, comma-separated; the first is used for the sign-in button. https (http only for `localhost`).                                                      |
| `ZITADEL_CLIENT_ID`                    |            | The confidential client registered at the issuer.                                                                                                                  |
| `ZITADEL_CLIENT_SECRET`                |            | Its secret.                                                                                                                                                         |
| `ZITADEL_CALLBACK_URL`                 | `<API_BASE_URL>/api/auth/zitadel/callback` | Register this redirect URI at the issuer (sign-in and linking both use it).                                                       |
| `ZITADEL_ALLOWED_AUDIENCES`            |            | Client ids of other first-party apps whose tokens `POST /api/auth/zitadel/token` accepts.                                                                           |
| `ZITADEL_LINK_MODE`                    | `explicit` | `explicit`: accounts are connected only from Settings. `confirmed` (Ever Cloud only): also at sign-in, after Gauzy's one-time e-mail code.                         |
| `ZITADEL_SIGNUP_ENABLED`               | `false`    | Ever Cloud only: a person new to Gauzy may create a workspace with Ever ID after confirming it.                                                                     |
| `ZITADEL_BACKCHANNEL_LOGOUT_ENABLED`   | `true`     | Ends sessions opened through Ever ID when the identity provider signs the person out.                                                                               |
| `ZITADEL_HANDOFF_TTL_S`                | `60`       | Lifetime of the one-time sign-in keys, seconds.                                                                                                                     |
| `ZITADEL_CONFIRM_TTL_S`                | `1800`     | Lifetime of pending confirmations, links and sign-ups, seconds.                                                                                                     |
| `ZITADEL_SCOPES`                       |            | Requested scopes. Default `openid profile email urn:zitadel:iam:user:resourceowner`, plus the project audience scope when `EVER_PLATFORM_PROJECT_ID` is set.        |
| `EVER_INSTALL_SOURCE`                  |            | `cloud` only on Ever Cloud. Nothing else is ever used to decide that an install is Ever Cloud.                                                                       |

Booleans accept exactly `true` or `false`; any other value is logged once and the default is used.

On an install that is not Ever Cloud, an issuer on an Ever host is not taken from `ZITADEL_ISSUERS`:
it can only be enabled through Ever Connect, so such an install never contacts Ever on its own. An
issuer on any other host (your own identity provider) is accepted.

The Ever ID button appears when the web app has `ZITADEL_AUTH_LINK` set (for example
`https://api.example.com/api/auth/zitadel`) **and** the API reports Ever ID sign-in as enabled. Switch
the API on first, check it, then set the link.

Multi-replica deployments must have Redis configured (`REDIS_ENABLED`), so a one-time key issued by
one replica can be redeemed on another, exactly once.

## Routes (`/api/auth/zitadel`)

| Route                          | Who            | Purpose                                                                                       |
| ------------------------------ | -------------- | --------------------------------------------------------------------------------------------- |
| `GET /config`                  | anyone         | Whether the sign-in is enabled, and which flows are on.                                      |
| `GET /`                        | anyone         | Starts a sign-in (PKCE, `state`, `nonce`; never a login hint).                                |
| `GET /callback`                | the issuer     | Returns from the issuer (sign-in and linking).                                                |
| `POST /handoff`                | anyone         | Redeems the one-time key of a redirect, once.                                                 |
| `POST /confirm`                | anyone         | `confirmed` mode: completes a link with Gauzy's one-time e-mail code (five tries).            |
| `POST /signup/details`, `POST /signup` | anyone | Ever Cloud sign-up: the confirmation page and the confirmation itself.                       |
| `POST /token`                  | first-party apps | Exchanges an Ever ID token of an allowed client for the workspace list.                    |
| `POST /link`, `GET /link/start`, `POST /link/preview`, `POST /link/confirm` | signed-in user | Connect an Ever ID from Settings. |
| `DELETE /link/:id`, `GET /identities` | signed-in user | Disconnect / list this account's Ever IDs.                                               |
| `POST /backchannel-logout`     | the issuer     | OpenID Connect back-channel logout.                                                           |

While the plugin is loaded but not configured, every route except `/config` answers 404 and no
outbound request is made.

## How it works

- **Sign-in.** After the issuer confirms the person, the plugin looks up the Gauzy users linked to that
  Ever ID and hands the browser an opaque one-time key; the web app redeems it for the workspace list
  and signs in through the unchanged `POST /api/auth/signin.workspace`. No token, e-mail address or
  other personal data is ever put in a URL. Gauzy's own access and refresh tokens are issued exactly as
  for the e-mail code sign-in.
- **No silent linking, no silent accounts.** An e-mail match alone never connects an Ever ID to an
  account and never creates one. A person without a link is sent to Gauzy's register page (prefilled),
  or, in `confirmed` mode, proves the mailbox with Gauzy's own one-time code first.
- **Linking from Settings.** Settings > Connected identities asks the signed-in person to sign in to
  Ever ID again (a fresh login, at most five minutes old, with a verified e-mail) and to confirm on a
  screen that shows both addresses. Accounts with the same address in other workspaces are linked only
  when ticked and proved with Gauzy's one-time code.
- **Ever Cloud sign-up.** With `ZITADEL_SIGNUP_ENABLED=true` on Ever Cloud, a person new to Gauzy is
  offered "Create a Gauzy workspace with this Ever ID". Nothing is created until they confirm; then
  Gauzy's own register path runs behind its own subscription check. Without a subscription the
  confirmed sign-up waits on the server (keyed to the Ever ID, for `ZITADEL_CONFIRM_TTL_S`) while the
  person goes through checkout, and finishes the next time they sign in with Ever ID.
- **Organization rules.** Optional hints in the ID token can remove a workspace from a sign-in (for
  example an organization that requires its company sign-in); they never grant access.
- **Back-channel logout.** Sessions opened through an Ever ID session end when the identity provider
  reports that session ended; a logout token is accepted once and only while fresh.

## Outbound requests

Only the configured issuer's discovery document, key set and token endpoint, and only while someone
signs in (the documents are cached). None while the plugin is off or unconfigured, and none at start.

## Data

Four tables, created by the core migration listed in `MIGRATIONS.md`: `zitadel_account` (links),
`zitadel_organization` (organization links), `zitadel_session` (sessions opened through Ever ID) and
`zitadel_logout_jti` (logout token replay cache). Ever ID tokens are never stored.

## Turning it off

1. Unset `ZITADEL_AUTH_LINK` in the web app: the button disappears.
2. Set `ZITADEL_ENABLED=false` (or unset it): the routes answer 404 and the plugin is not loaded.
   Sessions already open keep working; the tables stay.
3. Only to remove the tables: `yarn migration:revert` for the migration in `MIGRATIONS.md`.

## Build and test

```bash
yarn nx build plugin-auth-zitadel
yarn nx test plugin-auth-zitadel
```
