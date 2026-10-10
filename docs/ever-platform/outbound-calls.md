# What Ever Gauzy sends to Ever Platform

Ever Gauzy has two optional modules that talk to Ever Platform: the **anonymous usage statistics**
([`@gauzy/plugin-ever-stats`](../../packages/plugins/ever-stats/README.md)) and the **connection**
([`@gauzy/plugin-ever-connect`](../../packages/plugins/ever-connect/README.md)). This page lists every
call either of them can make. Nothing else in Gauzy calls Ever Platform.

## When nothing is sent

| Setting                                                                   | Effect                                                                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `EVER_STATS_ENABLED=false`                                                | The statistics module is not loaded: no route (`/api/ever-stats/*` answers 404), no timer, no request.   |
| Statistics switched off in Settings > Anonymous usage statistics          | The module stays loaded for the settings page; it sends nothing.                                         |
| `EVER_CONNECT_ENABLED` unset (the default), or anything but `true`        | The connection module is not loaded: no route (`/api/ever-connect/*` answers 404), no timer, no request. |
| `EVER_CONNECT_ENABLED=true`, not connected                                | Loaded and idle: no request until the operator of the installation connects with a code.                 |
| `ZITADEL_ENABLED=true` with an issuer on an Ever host, the connection off | The sign-in plugin does not use that issuer on a self-hosted installation, so nothing is sent to it.     |

Every call below needs its module on, and every call of the connection needs a connection the
operator made. A call that is listed but whose trigger never happens is never made.

## Every call

The table is generated from the outbound-call rows of the Ever Platform contract, at the exact version
the modules pin; a check in CI fails when the table, the modules' READMEs or the egress audit drift
from it. The row number is the contract's. Where Gauzy calls on a schedule of its own (row 8), the
"When" and "How often" columns give Gauzy's.

<!-- generated:version (node tools/ever-platform/outbound-calls.mjs --write, from the pinned contract; do not edit by hand) -->

Contract version: `1.0.0-rc.6` (`@ever-co/connect-contracts` and `@ever-co/connect-tools` at the same version).

<!-- /generated:version -->

<!-- generated:calls (node tools/ever-platform/outbound-calls.mjs --write, from the pinned contract; do not edit by hand) -->

| # | Module | Request | When | What it carries | How often | How to stop it |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | connection | `GET /.well-known/ever-keys.json` | first signature verification; every 24 h; an unknown key id | none (read) | at most every 24 h; at most once per 10 min on an unknown key id | disconnect, or leave EVER_CONNECT_ENABLED unset |
| 3 | connection | `POST /v1/connect/redeem` | the operator submits a connect code; EVER_CONNECT_CODE at first boot | code, product, version, install_source, kind (self_hosted; cloud on deployments Ever operates), serves_products[], public_jwk (the connect key), tenant {product_tenant_id, product_org_id?, display_name}? (absent values are omitted, never sent as null); never the installation's address | once | do not connect |
| 4 | connection | `POST /v1/instances/token` | while connected: before the token expires, and after a 401 | grant_type, client_assertion_type, client_assertion (issuer and subject are the Ever Platform instance id returned at connect, never the statistics instance id) | every 50 min while connected (a token is kept for its hour; at most 60 an hour); on a 401 | disconnect |
| 5 | connection | `POST /v1/instances/me/tenant-links`, `DELETE /v1/instances/me/tenant-links/{link}` | an organization admin submits a link code, removes a link, or a single-organization product moves its link to a new organization id | link_code, product, product_tenant_id, product_org_id?, display_name? of the tenant | on action | do not link |
| 6 | connection | `POST /v1/instances/me/heartbeat`, `GET /v1/instances/me` | while connected; the status read also while an approval is pending and when an admin opens the connection page | version, module_version?, serves_products[]? (heartbeat); none (status read) | within 5 min of boot, then every 24 h | disconnect |
| 7 | connection | `GET /v1/instances/me/events`, `POST /v1/instances/me/events/ack` | while connected | cursor only | continuous long-poll (wait=25), or one read every 15 min with EVER_CONNECT_FEED_MODE=interval | disconnect |
| 8 | connection | `GET /v1/instances/me/entitlement`, `GET /v1/instances/me/tenant-links/{link}/entitlement` | while connected: at connect and at each link, with each heartbeat, on an entitlement notice on the event feed, on demand (Refresh, at most 6 an hour) | none (read; If-None-Match with the cached sequence number) | with the heartbeat (every 24 h); on a notice; on demand | disconnect |
| 9 | connection | `GET /v1/instances/me/integrations`, `GET /v1/instances/me/consent-url` | after a consent notice; on return from app.ever.co; when an admin opens the integrations tab | integration, link, return (query) | on action or notice | disconnect |
| 10 | connection | `PUT /v1/instances/me/integrations/{key}` | an admin disables an integration locally; an operator policy denies it | enabled: false, reason (instance or policy), tenant_link_id? | on action | none needed: this call only ever disables |
| 11 | connection | `POST /v1/instances/me/stats-link` | integration stats_link enabled (self-hosted installations only) | stats_instance_id, stats_public_jwk, statement_sig: a statement signed with the separate statistics key, sent under the connect-key token, so app.ever.co can show the installation's last report | once; again after Reset instance identity | disable stats_link |
| 16 | connection | `POST /v1/instances/me/disconnect`, `POST /v1/instances/me/keys` | the operator disconnects; the connect key is rotated | none (disconnect); public_jwk of the new connect key with two rotation proofs, one signed with the current connect key and one with the new key (rotation; the statistics key is never rotated by this call) | on action | none needed: operator action only |
| 17 | statistics | `POST /v1/stats/reports` | statistics module loaded and enabled | the ever.stats.v1 document: statistics instance id, product, version, channel, install source, coarse country, month, allow-listed counts, feature flags and integer aggregates | once a day at a jittered time; at boot when the last send is older than 24 h; a final re-send of the previous month on days 1-3 | EVER_STATS_ENABLED=false, or the settings toggle |
| 31 | connection | `POST /v1/instances/me/integrations/{key}/accept` | the operator accepts or declines an installation-wide integration that waits for the local accept | consent_id, accepted | on action | none needed: operator action only |

<!-- /generated:calls -->

Every request goes to `EVER_PLATFORM_API_URL` (the statistics: `EVER_STATS_API_URL`), both
`https://api.ever.co` by default. No request carries a person's name or e-mail address. The module
READMEs say in detail what each request carries and when.

## Calls of the contract that Gauzy does not make

The contract describes more calls for Gauzy than this release makes. These are never made:

<!-- generated:not-made (node tools/ever-platform/outbound-calls.mjs --write, from the pinned contract; do not edit by hand) -->

| # | Calls | Why Gauzy does not make them |
| --- | --- | --- |
| 2 | Legal texts | not built in this release |
| 14 | Ever ID sign-in client | not served by version 1 of the Ever Platform API |
| 18 | Installation address | not built in this release |
| 19 | Person links | not served by version 1 of the Ever Platform API |
| 20 | Receipt for a deletion or export request | not served by version 1 of the Ever Platform API |
| 22 | Identity resolution | not served by version 1 of the Ever Platform API |
| 23 | Signed-in person's context | not built in this release |
| 25 | Cloud billing link | not served by version 1 of the Ever Platform API |
| 27 | Usage reports | not served by version 1 of the Ever Platform API |
| 30 | Webhook endpoint | not built in this release |
| 33 | In-product consent | not served by version 1 of the Ever Platform API |

<!-- /generated:not-made -->

## Older features that call Ever servers

None of Gauzy's other features calls an Ever server by default. The egress audit (below) checks it
on every published build, with both modules off: no Ever host is looked up or requested by the API or
by the web app.

## How it is checked

- **At run time**, the [egress audit](../../tools/egress-audit/README.md) runs the published API and
  web app images on Docker networks with no route out and records every DNS query and connection
  attempt, of the API and of a real browser that opens every page of the web app. With both modules
  off, or loaded but idle, there is none to an Ever host. With a module on, against a mock of Ever
  Platform, every call made is one of the table above.
- **In the code**, `node tools/egress-audit/static-hostnames.mjs` fails when code outside the modules
  names an Ever host (or the Ever Platform address variables) it did not name before, in the sources
  and in the built web app; `node tools/ever-platform/check-import-boundary.mjs` fails when code
  outside the modules imports them.

## How to verify yourself

Run the API with both modules off and capture its traffic (for example `tcpdump -i any host api.ever.co`,
or a Compose network with `internal: true`): there is none to Ever Platform. Or run the egress audit
locally:

```sh
npm ci --prefix tools/egress-audit
npx --prefix tools/egress-audit ever-egress-audit --config tools/egress-audit/egress-audit.config.json --mode off
```
