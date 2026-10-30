<!-- markdownlint-disable MD013 -- tables and paragraphs are kept on one line each (prettier formats the tables) -->

# @gauzy/plugin-ever-connect

Connects an Ever Gauzy installation to Ever Platform, links its organizations to Ever organizations, and keeps the state of each integration the organizations consent to in app.ever.co.

**Off by default.** Unless `EVER_CONNECT_ENABLED=true`, the module is not part of the API at all: no route (`/api/ever-connect/*` answers 404), no timer, no HTTP client object, no request. Loaded but not connected, it sends nothing until the operator of the installation submits a connect code.

The web part is [`@gauzy/plugin-ever-connect-ui`](../ever-connect-ui/README.md): **Integrations > Ever Platform**.

## When nothing is sent

| Setting                                              | Effect                                                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `EVER_CONNECT_ENABLED` unset, or anything but `true` | The module is not loaded. Nothing is sent, nothing is scheduled. Any value other than `true`/`false` is reported once in the log. |
| `EVER_CONNECT_ENABLED=true`, not connected           | Loaded and idle: no request, no timer, until the operator connects (or `EVER_CONNECT_CODE` is set).                               |
| Connected                                            | Only the requests listed below, each on its own trigger.                                                                          |

## Anonymous usage statistics

The anonymous usage statistics are a separate module with their own switch: see [`@gauzy/plugin-ever-stats`](../ever-stats/README.md). Connecting does not change them, and disconnecting does not stop them. The connection uses its own key; the statistics key never signs a connection request.

## Ever Platform connection

### Who can do what

- **The operator of the installation** (an active super admin listed in `EVER_OPERATOR_USER_IDS`, or by address in `EVER_OPERATOR_EMAILS` for an account of the first tenant, or the first super admin of a single-tenant installation; nobody when `EVER_INSTALL_SOURCE=cloud`): connects and disconnects the installation, sets the instance policy, and accepts or declines the installation-wide integrations. Everyone else gets 404 on these routes.
- **Organization administrators** (the existing integration permissions `INTEGRATION_VIEW/ADD/EDIT/DELETE`): link their organization with a link code, ask for the consent link of their organization's integrations, switch them off.
- Nobody enables an integration from Gauzy: an owner or administrator of the linked Ever organization consents in app.ever.co. An installation-wide integration (`instance_url`, `stats_link`, `ever_id_login`, `webhooks`) then waits for the operator's accept here, and nothing of it moves before.

### What connecting sends

`POST /v1/connect/redeem`: the connect code, `product` (`gauzy`), the Gauzy version, `install_source` (from `EVER_INSTALL_SOURCE`, never guessed), `kind` (`self_hosted`, or `cloud` with `EVER_INSTALL_SOURCE=cloud`), `serves_products: ["teams"]` when this API also serves Ever Teams (`EVER_STATS_SERVES`), the public part of the connection key this installation makes, the origin of the web app (`CLIENT_BASE_URL`) so app.ever.co can send an administrator back (only an https origin, or plain http on `localhost`, `127.0.0.1` or `[::1]`; Ever Platform keeps only a digest of it), and, when the operator chooses to link their organization at once, its tenant and organization ids. Never an address of the API, a name or an e-mail address. The ids Ever Platform answers (the Registry id, the key id of the key just sent, the link id) are checked before they are kept.

Before the code is used, Ever Platform's key manifest is fetched and verified; after it, the entitlement document is fetched and verified. When either cannot be verified, nothing is stored.

### Requests made while connected

All requests go through the Ever Platform SDK's client (`@ever-co/connect-sdk`, pinned to an exact version): only `EVER_PLATFORM_API_URL`, no redirects followed, no cookies, a 10 s deadline for writes and 6 s for reads, `User-Agent: ever-connect-sdk/<version> (gauzy/<version>)`, an `Idempotency-Key` on writes. The instance token is kept in memory only.

A spec checks this table against the outbound-call rows of the SDK's contracts package (`@ever-co/connect-contracts`, `ROWS`): every request below is one of the SDK's, under its row number.

| #   | Request                                                                                                              | When                                                                                                                                       | What it carries                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | `GET /.well-known/ever-keys.json`                                                                                    | before connecting; every 24 h; an unknown key id                                                                                           | nothing                                                                             |
| 3   | `POST /v1/connect/redeem`                                                                                            | the operator submits a code; `EVER_CONNECT_CODE` once                                                                                      | see above                                                                           |
| 4   | `POST /v1/instances/token`                                                                                           | when a token is needed (one an hour)                                                                                                       | a client assertion signed with the connection key                                   |
| 5   | `POST /v1/instances/me/tenant-links`, `DELETE /v1/instances/me/tenant-links/{link}`                                  | an administrator links or unlinks an organization; a linked Gauzy organization or tenant is deleted                                        | the link code, `gauzy`, the tenant and organization ids                             |
| 6   | `POST /v1/instances/me/heartbeat`, `GET /v1/instances/me`                                                            | a minute after connecting or starting, then every 24 h; **Check again** on a connection waiting for approval                               | the version, the module version, the products served, the integrations denied here |
| 7   | `GET /v1/instances/me/events`, `POST /v1/instances/me/events/ack`                                                    | a long poll (or every 15 min with `EVER_CONNECT_FEED_MODE=interval`)                                                                       | the feed cursor                                                                     |
| 8   | `GET /v1/instances/me/entitlement`, `GET /v1/instances/me/tenant-links/{link}/entitlement`                           | connect, link, each heartbeat, an `entitlement` event, Refresh                                                                             | the stored sequence number (`If-None-Match`)                                        |
| 9   | `GET /v1/instances/me/integrations`, `GET /v1/instances/me/consent-url`                                              | connect, link, an event about a consent, the Integrations & data tab (at most once every 30 s per API process); "Enable in app.ever.co…" | the integration key, the link, the return address                                   |
| 10  | `PUT /v1/instances/me/integrations/{key}`                                                                            | an integration switched off here, or denied by the operator (again at each heartbeat until Ever Platform takes it)                        | `enabled: false`, the reason, the link                                              |
| 11  | `POST /v1/instances/me/stats-link`                                                                                   | once, when `stats_link` is enabled (consent in app.ever.co and the operator's accept); never with `EVER_INSTALL_SOURCE=cloud`              | the anonymous statistics id and public key, signed with the statistics key          |
| 14  | `POST /v1/instances/me/oidc-client`, `GET /v1/instances/me/oidc-client`                                              | once, when Sign in with Ever ID is enabled; then read until the client is ready (5 s, then less often, at most every 5 min)                | the Ever ID callback and back-channel logout addresses of this API                  |
| 16  | `POST /v1/instances/me/disconnect`, `POST /v1/instances/me/keys`                                                     | the operator disconnects; the operator replaces the connection key                                                                         | nothing; the new public key and two proofs (signed with the old and the new key)    |
| 19  | `POST /v1/instances/me/person-links`, `DELETE /v1/instances/me/person-links/{ref}`                                  | a Gauzy user of a linked tenant links or unlinks an Ever ID while Sign in with Ever ID is enabled; the existing links once, when it starts | the Gauzy user id, the Ever ID issuer and subject, how the link was made, the tenant and organization ids, the tenant link, the tenant's name |
| 20  | `POST /v1/instances/me/ack`                                                                                          | a person's deletion or export request arrives on the event feed                                                                           | the request's job id, the answer, a reason code or the link to this installation's own export |
| 22  | `POST /v1/identity/resolve`                                                                                          | an Ever ID sign-in whose token carries none of Ever Platform's claims, while Sign in with Ever ID is enabled                               | the Ever ID issuer and subject                                                      |
| 31  | `POST /v1/instances/me/integrations/{key}/accept`                                                                    | the operator accepts or declines an installation-wide integration                                                                          | the consent id, accepted or not                                                     |

No request is made on sign-in or when a record changes, except the removal of the link of a Gauzy organization or tenant that was deleted (row 5) and, while Sign in with Ever ID is enabled, the Ever ID links of Gauzy users (row 19) and an Ever ID sign-in whose token carries none of Ever Platform's claims (row 22, at most 6 seconds; the sign-in goes on without an answer). Opening the Integrations & data tab re-reads the states (row 9) at most once every 30 seconds per API process, whoever opens it. No request carries a person's name or e-mail address.

### Integrations in this release

| Integration                           | State here                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Installation address (`instance_url`) | consent in app.ever.co, then the operator's accept; sending the address itself is not available yet |
| Link usage statistics (`stats_link`)  | consent in app.ever.co, then the operator's accept; not offered with `EVER_INSTALL_SOURCE=cloud`    |
| Sign in with Ever ID (`ever_id_login`) | consent in app.ever.co, then the operator's accept; "coming soon" while Ever Platform says so    |
| Every other integration               | "coming soon": nothing of it moves, whatever Ever Platform says                                     |

The definitions (what each one moves, why, how often, what Ever Platform keeps) are the Ever Platform SDK's, the same data app.ever.co shows on its consent screen; **Show scope** shows them read-only.

### Switching off, disconnecting, revocation

- **Disable** switches an integration off here first, always: nothing of it runs any more, whatever Ever Platform answers (a redirect, a refusal, no answer at all). Ever Platform is then told, and told again at each heartbeat until it takes it.
- An **installation-wide integration** runs only after the operator's accept here, for that consent: when Ever Platform reads one as enabled without that accept (or after a new consent), it waits for the operator.
- The **instance policy** (or `EVER_CONNECT_INTEGRATIONS_DENY`, which wins) denies an integration for every organization of the installation.
- **Disconnect** tells Ever Platform (at most 10 seconds), then, whatever it answered, switches every integration off, archives the links, deletes the entitlement documents, drops the connection key (the next connect makes a new one) and stops the heartbeat and the feed.
- When Ever Platform revokes the installation, the same steps run.
- **Replace key** (Connection tab) makes a new connection key and installs it on Ever Platform with two proofs, one signed with each key; the installation stays connected.
- When `ENCRYPTION_KEY` or `JWT_SECRET` changes, the connection key can no longer be read: nothing can be sent, and the Connection tab says so. Disconnect, then connect again with a new code: a new key is made.

### Sign in with Ever ID

Lets the people of this installation sign in with their Ever ID through this installation's own sign-in client, without the operator creating one by hand. It needs the Ever ID sign-in plugin ([`@gauzy/plugin-auth-zitadel`](../auth-zitadel/README.md)) and an https `API_BASE_URL` (or `ZITADEL_CALLBACK_URL`).

- **What enabling sends:** the Ever ID callback (`ZITADEL_CALLBACK_URL`, else `${API_BASE_URL}/api/auth/zitadel/callback`) and the back-channel logout address next to it (row 14). Nothing else.
- **What it receives:** the Ever ID issuer, the client id and the client secret. The secret is handed over once; it is stored encrypted (AES-256-GCM, like the connection key) and given to the Ever ID sign-in plugin, where settings from the environment win, key by key. If it is lost (`ENCRYPTION_KEY` or `JWT_SECRET` changed, or it was handed over before), the Integrations & data tab says to enable the integration again in app.ever.co.
- **Switching it off**, its revocation in app.ever.co and a disconnect forget the client here (Ever Platform deactivates it); the Ever ID links of Gauzy users stay, and so do their Gauzy accounts.
- **Links:** while it is enabled, a Gauzy user of a tenant linked to an Ever organization who links or unlinks an Ever ID of Ever Platform's issuer is reported (row 19), so that the person's deletion or export request later reaches this installation. Only ids, the issuer and subject, how the link was made and the tenant's name are sent; never an e-mail address or a person's name. The reports of one user are sent in the order they were made. A report that does not go through is retried for up to a day, then given up (audited). Once the client is ready, the links that existed before are reported once, for the linked tenants only (retried until done, also after a restart).
- **Sign-in:** a sign-in whose ID token carries none of Ever Platform's `urn:ever:*` claims asks Ever Platform about that identity (row 22), only for Ever Platform's own issuer, and goes on without the answer after 6 seconds.

### A person's deletion and export requests

When a person whose Ever ID is linked here asks Ever Platform to delete or export their data, the request arrives on the event feed (`ever.registry.person.deletion_requested`, `ever.registry.person.export_requested`) naming the person's identities by digest only (`sha256(<issuer>#<subject>)`). Each request is recorded by its event id, with the identities it names and the Gauzy users linked to them (looked up before anything is removed), and answered once (row 20); a handling that stopped half-way is taken up again for the same accounts, and an answer that cannot be sent is kept and sent again. Answers are not gated by any integration: a request already received stays answerable after Sign in with Ever ID is switched off.

| Request  | Here                                                                                                                                | Answer                                                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Deletion | the link reports of those identities are removed, the Ever ID links are removed and the Gauzy sessions opened through them end; then the account-deletion feature | `deleted`, `anonymised` or `retained_legal` (with the legal basis) from that feature; `failed` (`account_deletion_pending`) while none is bound: the links are gone but the accounts still hold the person's data, so the request stays open; `no_account` when nothing is linked |
| Export   | the export feature prepares an export of the linked accounts                                                                          | `exported` with the https link to that export (Ever Platform stores the link and never fetches it); `failed` (`export_not_available`) while none is bound; `no_account` |

### `/.well-known/ever-connect`

Registered outside `/api` while this module is loaded. It answers only while Ever Platform checks the installation's address (after `instance_url` was consented and accepted, at most 10 minutes): a short-lived statement signed with the connection key, `{iss: <the installation's id>, aud: "urn:ever:instance-url", url, iat, exp}` with `exp` at most 10 minutes after `iat`. At any other time it answers 404, exactly as an address that does not exist. This release does not send the installation's address yet, so it always answers 404.

### Entitlements

Ever Platform signs an entitlement document for the installation and one for each linked organization; the module verifies each one (issuer, key, signature, schema, this installation and the expected organization link, never older than the stored one) before it stores it, and refreshes them with the heartbeat, on the feed's entitlement events and on demand (*Refresh*, at most 6 an hour).

- **Grace ladder**: a document is *valid* until it expires (7 days after it was issued), then in *grace* for 30 days (or the `grace_s` it names): its Ever Platform features still apply and the Entitlements tab says since when it could not be refreshed. After that, or without a document, or once the installation was revoked, the Ever Platform features of that organization are *paused*. Nothing else of Gauzy depends on a document: every other feature, route and setting works the same with or without one.
- **Licence line**: each licence certificate id a document names is shown as "Licence EVER-… active". It is shown, never checked by any feature.
- **Offline import**: an installation without a route to Ever Platform imports a downloaded document, from the Entitlements tab (the operator, `POST /api/ever-connect/entitlement/import` with `{ "jws": "…" }`, at most 16 KiB) or with `EVER_ENTITLEMENT_FILE` at start. The same checks apply; the document must name this installation or one of its organization links (otherwise 422), and the installation must have been connected once (otherwise 409). A document is stored only if no other was stored while it was verified (compare and set; otherwise 409 `entitlement_changed`, import again). Stored and refused documents are audited, never the document itself.

### What is stored

Tables `ever_connect_connection`, `ever_connect_link`, `ever_connect_integration`, `ever_connect_policy`, `ever_connect_audit`, `ever_connect_lookup_cache`, `ever_connect_person_link_report` (the Ever ID links waiting to be reported) and `ever_connect_person_request` (a person's requests and the answers given) (see [MIGRATIONS.md](MIGRATIONS.md)); a link is also recorded as an `integration_tenant` named `Ever_Connect`. The connection key (in `ever_instance`), the entitlement documents, Sign in with Ever ID's client and an export link are stored encrypted (AES-256-GCM, from `ENCRYPTION_KEY`, else from a non-default `JWT_SECRET`); connecting is refused without one of them. The audit holds ids and states only. None of it is included in export archives.

- **After a disconnect** the connection row keeps its ids and times (status `disconnected`, no document, no key), the links stay as archived rows (`unlinked`, no document), and the integration states, the policy and the audit stay, for the operator.
- **When a Gauzy organization or tenant is deleted**, its link is removed on Ever Platform (best effort) and here, and its rows are deleted from `ever_connect_link`, `ever_connect_integration`, `ever_connect_lookup_cache` and `ever_connect_audit`; the audit keeps one row of the installation saying a deleted organization's link was removed, without the organization's ids. The tables have no foreign keys, so this runs when Gauzy deletes the organization through its entities and, for any other deletion, before each heartbeat, each read of the event feed and each re-read of the states.

## Environment variables

| Variable                                               | Default               | Meaning                                                                                                                               |
| ------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `EVER_CONNECT_ENABLED`                                 | unset (off)           | `true` loads the module                                                                                                               |
| `EVER_PLATFORM_API_URL`                                | `https://api.ever.co` | Ever Platform's address (https; plain http only for a local or private address, with a warning). An address that cannot be used means nothing is sent |
| `EVER_CONNECT_CODE`                                    | unset                 | a connect code used once at the first start; any answer uses it up, only a network failure is retried                                 |
| `EVER_CONNECT_INTEGRATIONS_DENY`                       | unset                 | integration keys denied for every organization (comma separated, or `*`)                                                              |
| `EVER_CONNECT_FEED_MODE`                               | `longpoll`            | `interval`: one read of the event feed every 15 minutes                                                                               |
| `EVER_ENTITLEMENT_FILE`                                | unset                 | a downloaded entitlement document (`.jws`), imported once when the connection starts, for an installation without a route to Ever Platform; the operator can also import one on the Entitlements tab |
| `EVER_INSTALL_SOURCE`                                  | `self-hosted`         | how the installation is deployed, declared by the operator; `cloud` means Ever operates it                                            |
| `EVER_OPERATOR_USER_IDS`, `EVER_OPERATOR_EMAILS`       | unset                 | the operators of the installation (shared with the statistics module)                                                                 |
| `ENCRYPTION_KEY`                                       | unset                 | the key the connection key and documents are stored under (else a non-default `JWT_SECRET`)                                           |
| `CLIENT_BASE_URL`                                      |                       | the web app address app.ever.co may send an administrator back to (only its origin is declared; https, or plain http on `localhost`, `127.0.0.1` or `[::1]`, else not sent) |
| `EVER_PLATFORM_ISSUER`, `EVER_PLATFORM_ROOT_KEYS_FILE` | unset                 | tests against a mock platform only: honoured only when `EVER_PLATFORM_API_URL` is a local or private address (`localhost`, `127.0.0.0/8`, `::1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), as the SDK honours them; never for a public address |

## How to verify yourself

Run the API with `EVER_CONNECT_ENABLED` unset and capture its traffic (for example `tcpdump -i any host api.ever.co`, or a Compose network with `internal: true`): there is none from this module, and `/api/ever-connect/status` answers 404. Set `EVER_CONNECT_ENABLED=true` without connecting: still none. After connecting, every request is one of the table above.
