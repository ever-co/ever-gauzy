# @gauzy/plugin-ever-stats: anonymous usage statistics

Once a day, an Ever Gauzy API sends Ever Platform one small, signed report about the installation as a whole: which version runs, which modules are switched on, how many tenants, users, employees and projects exist, and monthly totals per currency. The report never contains a name, an e-mail address, a company, an address, a document, an amount per record or any free text, and its shape is fixed by a published schema, so you can check every byte. (Amounts are monthly totals per currency: on a small installation, a month with a single invoice has that invoice's amount as its total.)

It is on by default and you can switch it off at any time, in Settings or with one environment variable.

- [When nothing is sent](#when-nothing-is-sent)
- [What is sent](#what-is-sent)
- [Environment variables](#environment-variables)
- [Who can see the settings](#who-can-see-the-settings)
- [How to verify yourself](#how-to-verify-yourself)
- [For developers](#for-developers)

## When nothing is sent

| Situation | Result |
|---|---|
| `EVER_STATS_ENABLED=false` | The module is not loaded at all: no route (every `/api/ever-stats/*` answers 404), no timer, no outbound request. It works from the container environment, `.env` and `.env.local`, however the API is started; the module also reads it again at start and before every report, so it never sends while it says `false`. |
| Switched off in Settings > Anonymous usage statistics | The module stays loaded so the page keeps working, but the scheduler sends nothing (a report being prepared when you switch off is not sent) and *Send now* answers 409. |
| `EVER_STATS_API_URL` set to an address that cannot be used | Nothing is sent, to any address; the settings page says why. The default address is never used instead of yours. |
| The stored statistics key cannot be read (`ENCRYPTION_KEY` or `JWT_SECRET` changed) | Nothing is sent; the settings page says so. *Reset instance identity* makes a new key. |
| The report fails its own checks | It is refused before signing and never sent; the settings page shows which field (never its value). |
| Ever Platform refused a report: `422`, or `409 key_mismatch` | Nothing more is sent until this module's version, the Gauzy release or the identity changes. |
| Ever Platform refused a report: `400`, `413` or `415` | The same, but for at most 7 days. |

Only `EVER_STATS_ENABLED=false` switches the module off. Unset, empty or `true` keep it on; any other value (`TRUE`, `1`, ...) keeps the default and logs one warning. The Gauzy desktop apps turn `false`, `off`, `no` and `0` typed in their settings into `false`.

## What is sent

**One call:** `POST {EVER_STATS_API_URL}/v1/stats/reports` (default `https://api.ever.co`).

| | |
|---|---|
| Schedule | Once per UTC day, at a second drawn at random for each report. The first report goes out one day after the first start (ten minutes after a start when the last report is more than a day old). On days 1 to 3 of a month the previous month is sent once more with `final: true`. Several API processes on one database send one report: a lease in the database lets one of them send. |
| Body | One JSON document, `ever.stats.v1`, at most 16 KiB, integers only. The schema is published in the public Ever Platform SDK repository ([`ever.stats.v1.json`](https://github.com/ever-co/ever-connect-sdk/blob/2fd74dad9357a18471292f38012a5f5e4e6d2938/contracts/schemas/ever.stats.v1.json)); a copy is in `src/lib/schema/ever.stats.v1.schema.json` (its SHA-256 is in `src/lib/schema/schema-hash.ts`). |
| Headers | `Ever-Stats-Key`: the public part of this installation's statistics key (Ed25519, base64url); `Ever-Stats-Signature: ed25519=<signature over the exact body>`; `Ever-Stats-Key-Id`; `User-Agent: gauzy-ever-stats/<module version> (gauzy/<version>)`. No cookie, no credential, no redirect followed, 10 s timeout. |
| Retries | `202`: done. `429`, `5xx` or a connection error: again after 1 h, 4 h, 12 h, then the next day. `404` (the endpoint is not available), a redirect or any other answer: the next day. The answer body is read up to 64 KiB. |

The statistics key is made at first start, stored encrypted in the database (with `ENCRYPTION_KEY`, else `JWT_SECRET`, else a fixed value from the public source code; see `@gauzy/plugin-ever-instance`), and used for nothing else than signing these reports. Ever Platform remembers the key of an installation id on the first report it accepts, so nobody else can send reports in its name.

### The fields

| Field | Content |
|---|---|
| `schema`, `report_id`, `sent_at`, `module_version` | `ever.stats.v1`, a random id per report, the UTC date (no time of day), the version of this module |
| `instance_id` | A random id made at first start (not derived from anything). *Reset instance identity* replaces it. |
| `product`, `instance_kind`, `serves` | `gauzy`, `backend`, and `["gauzy"]` or `["gauzy","teams"]` (`EVER_STATS_SERVES`) |
| `version`, `channel` | The release (`major.minor.patch` only) and its channel (`stable`, `rc`, `beta`, `dev`, `custom`). A build suffix is never sent: it could name a company. |
| `install_source` | `EVER_INSTALL_SOURCE`, as you declare it (default `self-hosted`). It is never guessed. |
| `country` | `EVER_STATS_COUNTRY`, as you declare it, or `ZZ` (undeclared). Never derived from your data or an address. |
| `period`, `final` | The calendar month (UTC) the numbers describe, and whether that month is closed |
| `counts` | `tenants`, `organizations`, `users`, `users_active_30d`, `employees`, `employees_active`, `teams`, `projects`, `tasks`, `contacts`, and `integrations_in_use` (per integration, the number of tenants using it) |
| `features` | Each `FEATURE_*` module switch, `true` or `false` |
| `aggregates` | For the month: `invoiced_minor` and `payments_minor` (totals per currency, in integer minor units such as cents), `invoices`, `payments` (how many), `hours_tracked_min` (minutes tracked) |

Every number covers the whole installation, all tenants together. Every installation, whatever its size, sends the same fields.

**Never included:** names of people or companies, e-mail addresses, postal addresses, tax or registration numbers, invoice numbers, document contents, per-record amounts, free text, URLs, host names, IP addresses or precise locations.

An example, from the published fixtures (`src/lib/schema/fixtures/valid/gauzy.json`; this module sends its own `module_version`, `0.1.0`):

```json
{
  "schema": "ever.stats.v1",
  "report_id": "9f1c1d4a-7b2e-4f0a-9d3c-2a6b1e5f8c01",
  "instance_id": "3d2b1a0c-5e4f-4a6b-8c7d-9e0f1a2b3c4d",
  "sent_at": "2026-10-03",
  "module_version": "1.0.0",
  "product": "gauzy",
  "instance_kind": "backend",
  "serves": ["gauzy", "teams"],
  "version": "0.750.1",
  "channel": "stable",
  "install_source": "self-hosted",
  "country": "ZZ",
  "period": "2026-09",
  "final": true,
  "counts": { "tenants": 3, "organizations": 4, "users": 41, "users_active_30d": 30, "employees": 27, "employees_active": 25, "teams": 6, "projects": 18, "tasks": 912, "contacts": 57, "integrations_in_use": { "github": 1, "ever_connect": 0 } },
  "features": { "time_tracking": true, "invoice": true, "payment": true, "open_stats": false },
  "aggregates": { "invoiced_minor": { "EUR": 18230055, "USD": 950000 }, "invoices": 214, "payments_minor": { "EUR": 17500000 }, "payments": 190, "hours_tracked_min": 259140 }
}
```

### Settings > Anonymous usage statistics

The operator of the installation sees: the switch and why nothing is sent, the next report, the last attempt and its HTTP status, *What is sent* (the report as it would be built now; nothing is stored or sent; built at most once a minute), *Last payload* (the exact bytes sent last time, formatted or unchanged), *Send now* (once per 10 minutes), and *Reset instance identity* (a new `instance_id` and a new statistics key; Ever Platform then counts the installation as new, and earlier reports can no longer be linked to it; it waits for a report being sent, on any API process). The page also warns, from how the key is actually stored, until it is protected by `ENCRYPTION_KEY` (see `@gauzy/plugin-ever-instance`).

The last 12 reports are kept in the `ever_stats_report` table, with their exact bytes and results.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `EVER_STATS_ENABLED` | on | `false` removes the module (no route, no timer, no request). |
| `EVER_STATS_API_URL` | `EVER_PLATFORM_API_URL`, else `https://api.ever.co` | Where reports go. Plain `http` is accepted only for `localhost`, a private address or a single-label host name (a container, not `metadata`), for tests and mirrors. An address that cannot be used means nothing is sent. |
| `EVER_STATS_COUNTRY` | `ZZ` | Two-letter country you declare. |
| `EVER_STATS_SERVES` | `gauzy` | `gauzy,teams` when an Ever Teams web app uses this API: the report says so, and `GET /api/ever-stats/state` exists (see below). |
| `EVER_INSTALL_SOURCE` | `self-hosted` | `self-hosted`, `cloud`, `desktop`, `ever.sh`, `works_app` or `partner:<slug>`, where `<slug>` is the id of a published partner template (Ever Platform counts any other slug as `partner:other`). The Gauzy desktop apps (Gauzy Desktop with its local server, Gauzy Server, Gauzy API Server) set `desktop` and their release version for their embedded API. |
| `EVER_OPERATOR_USER_IDS` | unset | The operators of the installation, by Gauzy user id (comma separated); see below. |
| `EVER_OPERATOR_EMAILS` | unset | The operators of the installation, by confirmed e-mail address (comma separated); see below. |
| `EVER_STATS_SEND_INTERVAL_S` | `86400` | Tests only: shortens the day (every delay scales with it). Below `3600` only with a local `EVER_STATS_API_URL`. |

## Who can see the settings

The report covers every tenant of the installation, so only its **operator** can see it or change it. The operator is a super admin (now: not deleted, active, not archived) who is:

- listed by user id in `EVER_OPERATOR_USER_IDS` (recommended on an installation with several tenants); or
- listed by address in `EVER_OPERATOR_EMAILS`. In Gauzy an address is not unique (one person can hold accounts in several tenants) and is not proven at registration, so a listed address names **one account only: the first account ever created with it**, and only once that account has confirmed the address. An account registered later with the same address, in any tenant, is never the operator; deleting or deactivating the first account does not pass the address on. When that first account is not yours, use `EVER_OPERATOR_USER_IDS`; or
- when neither list is set and the installation has a single tenant: that tenant's first super admin, remembered once (and replaced by the next super admin when that user is deleted, deactivated or no longer a super admin).

With more than one tenant and no list, nobody is the operator until you set one. On an installation declared as Ever's cloud (`EVER_INSTALL_SOURCE=cloud`) nobody is. Every other signed-in user gets 404 from the statistics routes (a request without a session gets the API's usual 401), and the settings page says "Managed by the instance operator", with how an operator takes the page over and a link to the published schema, never the payload.

### Routes (all `Cache-Control: no-store`)

| Route | Who |
|---|---|
| `GET /api/ever-stats/status`, `GET /api/ever-stats/last`, `POST /api/ever-stats/preview` | the operator |
| `PUT /api/ever-stats/enabled` `{"enabled": true\|false}`, `POST /api/ever-stats/send-now`, `POST /api/ever-stats/reset-identity` `{"confirm": true}` | the operator |
| `GET /api/ever-stats/state` | anyone, without authentication; it exists only with `EVER_STATS_SERVES` naming `teams` and answers `{"enabled": true\|false}` and nothing else (the Ever Teams server reads it before sending its own version-only report) |

Every route that answers without authentication is declared in `ever-connect.routes.json`; a test fails when the module registers one that is not declared there.

## How to verify yourself

1. Open Settings > Anonymous usage statistics, *What is sent*, and compare it with the schema.
2. Watch the traffic of the API host or container (for example `tcpdump -i any host api.ever.co`): with `EVER_STATS_ENABLED=false` and a restart, no connection is made; switched back on, you see one scheduled `POST /v1/stats/reports` a day (two on days 1 to 3 of a month, when the previous month is sent once more), plus retries after a failure and each *Send now*.
3. Point `EVER_STATS_API_URL` at your own endpoint (for example a local HTTP server that prints the request) and compare the body with *Last payload*: they are the same bytes, and the `Ever-Stats-Signature` verifies with the `Ever-Stats-Key` over exactly those bytes.

## For developers

- Counters: one `COUNT(*)` or `SUM()` over a whole table per number, with the plugin's own SQL (`src/lib/ever-stats-collector.service.ts`), so no request context or tenant filter can narrow them, wherever the collection runs. On Postgres they run in one transaction with a 30 s statement timeout.
- The schema, its fixtures and the checks Ever Platform runs (`src/lib/vendor/stats-checks.ts`) are copied from `ever-co/ever-connect-sdk` at commit `2fd74da`. Update them together; `schema.drift.spec.ts` pins both.
- Tests: `yarn nx test plugin-ever-stats`; the database suites (`*.db.spec.ts`: migrations, identity, lease, counters, the canary, and the module in an operator's request) also run on Postgres or MySQL with `EVER_STATS_TEST_POSTGRES_URL` / `EVER_STATS_TEST_MYSQL_URL` (`yarn nx run plugin-ever-stats:test-integration`; CI runs both). `yarn nx run plugin-ever-stats:test-mock-platform` runs the plugin against the Ever Platform mock of `ever-co/ever-connect-sdk` (`EVER_STATS_MOCK_PLATFORM_URL`): a report accepted when on, no call at all when switched off by `EVER_STATS_ENABLED=false` or in Settings, and a control without the mock that must fail. CI runs it in `build-api`.
- Tables and migrations: see `MIGRATIONS.md`.
