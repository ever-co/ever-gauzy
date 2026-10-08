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

`POST /v1/connect/redeem`: the connect code, `product` (`gauzy`), the Gauzy version, `install_source` (from `EVER_INSTALL_SOURCE`, never guessed), `kind` (`self_hosted`, or `cloud` with `EVER_INSTALL_SOURCE=cloud`), the public part of the connection key this installation makes, the origin of the web app (`CLIENT_BASE_URL`) so app.ever.co can send an administrator back (Ever Platform keeps only a digest of it), and, when the operator chooses to link their organization at once, its tenant and organization ids. Never an address of the API, a name or an e-mail address.

Before the code is used, Ever Platform's key manifest is fetched and verified; after it, the entitlement document is fetched and verified. When either cannot be verified, nothing is stored.

### Requests made while connected

All requests go through the Ever Platform SDK's client (`@ever-co/connect-sdk`, pinned to an exact version): only `EVER_PLATFORM_API_URL`, no redirects followed, no cookies, a 10 s deadline for writes and 6 s for reads, `User-Agent: ever-connect-sdk/<version> (gauzy/<version>)`, an `Idempotency-Key` on writes. The instance token is kept in memory only.

| #   | Request                                                                     | When                                                                                                                          | What it carries                                                            |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | `GET /.well-known/ever-keys.json`                                           | before connecting; every 24 h; an unknown key id                                                                              | nothing                                                                    |
| 3   | `POST /v1/connect/redeem`                                                   | the operator submits a code; `EVER_CONNECT_CODE` once                                                                         | see above                                                                  |
| 4   | `POST /v1/instances/token`                                                  | when a token is needed (one an hour)                                                                                          | a client assertion signed with the connection key                          |
| 5   | `POST /v1/instances/me/tenant-links`, `DELETE …/{link}`                     | an administrator links or unlinks an organization                                                                             | the link code, `gauzy`, the tenant and organization ids                    |
| 6   | `POST /v1/instances/me/heartbeat`                                           | a minute after connecting or starting, then every 24 h                                                                        | the version, the products served, the integrations the operator denies     |
| 7   | `GET /v1/instances/me/events`, `POST …/events/ack`                          | a long poll (or every 15 min with `EVER_CONNECT_FEED_MODE=interval`)                                                          | the feed cursor                                                            |
| 8   | `GET /v1/instances/me/entitlement`, `GET …/tenant-links/{link}/entitlement` | connect, link, each heartbeat, an `entitlement` event, Refresh                                                                | the stored sequence number (`If-None-Match`)                               |
| 9   | `GET /v1/instances/me/integrations`, `GET …/consent-url`                    | an event about a consent; Refresh; "Enable in app.ever.co…"                                                                   | the integration key, the link, the return address                          |
| 10  | `PUT /v1/instances/me/integrations/{key}`                                   | an integration switched off here, or denied by the operator                                                                   | `enabled: false`, the reason, the link                                     |
| 11  | `POST /v1/instances/me/stats-link`                                          | once, when `stats_link` is enabled (consent in app.ever.co and the operator's accept); never with `EVER_INSTALL_SOURCE=cloud` | the anonymous statistics id and public key, signed with the statistics key |
| 16  | `POST /v1/instances/me/disconnect`                                          | the operator disconnects                                                                                                      | nothing                                                                    |
| 31  | `POST /v1/instances/me/integrations/{key}/accept`                           | the operator accepts or declines an installation-wide integration                                                             | the consent id, accepted or not                                            |

No request is made on sign-in, on a page view, or when a record changes. No request carries a person's name or e-mail address.

### Integrations in this release

| Integration                           | State here                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Installation address (`instance_url`) | consent in app.ever.co, then the operator's accept; sending the address itself is not available yet |
| Link usage statistics (`stats_link`)  | consent in app.ever.co, then the operator's accept; not offered with `EVER_INSTALL_SOURCE=cloud`    |
| Every other integration               | "coming soon": nothing of it moves, whatever Ever Platform says                                     |

The definitions (what each one moves, why, how often, what Ever Platform keeps) are the Ever Platform SDK's, the same data app.ever.co shows on its consent screen; **Show scope** shows them read-only.

### Switching off, disconnecting, revocation

- **Disable** switches an integration off here at once, and tells Ever Platform; when it cannot be reached, the integration is off anyway and Ever Platform is told at the next heartbeat.
- The **instance policy** (or `EVER_CONNECT_INTEGRATIONS_DENY`, which wins) denies an integration for every organization of the installation.
- **Disconnect** tells Ever Platform (at most 10 seconds), then, whatever it answered, switches every integration off, archives the links, deletes the entitlement documents and stops the heartbeat and the feed.
- When Ever Platform revokes the installation, the same steps run, and the connection key is dropped: the next connect makes a new one.

### What is stored

Tables `ever_connect_connection`, `ever_connect_link`, `ever_connect_integration`, `ever_connect_policy`, `ever_connect_audit` and `ever_connect_lookup_cache` (see [MIGRATIONS.md](MIGRATIONS.md)); a link is also recorded as an `integration_tenant` named `Ever_Connect`. The connection key (in `ever_instance`) and the entitlement documents are stored encrypted (AES-256-GCM, from `ENCRYPTION_KEY`, else from a non-default `JWT_SECRET`); connecting is refused without one of them. The audit holds ids and states only. None of it is included in export archives.

## Environment variables

| Variable                                               | Default               | Meaning                                                                                                                               |
| ------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `EVER_CONNECT_ENABLED`                                 | unset (off)           | `true` loads the module                                                                                                               |
| `EVER_PLATFORM_API_URL`                                | `https://api.ever.co` | Ever Platform's address (https; plain http only for a local or private address). An address that cannot be used means nothing is sent |
| `EVER_CONNECT_CODE`                                    | unset                 | a connect code used once at the first start; any answer uses it up, only a network failure is retried                                 |
| `EVER_CONNECT_INTEGRATIONS_DENY`                       | unset                 | integration keys denied for every organization (comma separated, or `*`)                                                              |
| `EVER_CONNECT_FEED_MODE`                               | `longpoll`            | `interval`: one read of the event feed every 15 minutes                                                                               |
| `EVER_INSTALL_SOURCE`                                  | `self-hosted`         | how the installation is deployed, declared by the operator; `cloud` means Ever operates it                                            |
| `EVER_OPERATOR_USER_IDS`, `EVER_OPERATOR_EMAILS`       | unset                 | the operators of the installation (shared with the statistics module)                                                                 |
| `ENCRYPTION_KEY`                                       | unset                 | the key the connection key and documents are stored under (else a non-default `JWT_SECRET`)                                           |
| `CLIENT_BASE_URL`                                      |                       | the web app address app.ever.co may send an administrator back to (only its origin is declared)                                       |
| `EVER_PLATFORM_ISSUER`, `EVER_PLATFORM_ROOT_KEYS_FILE` | unset                 | tests against a mock platform only: honoured only when `EVER_PLATFORM_API_URL` is a local address                                     |

## How to verify yourself

Run the API with `EVER_CONNECT_ENABLED` unset and capture its traffic (for example `tcpdump -i any host api.ever.co`, or a Compose network with `internal: true`): there is none from this module, and `/api/ever-connect/status` answers 404. Set `EVER_CONNECT_ENABLED=true` without connecting: still none. After connecting, every request is one of the table above.
