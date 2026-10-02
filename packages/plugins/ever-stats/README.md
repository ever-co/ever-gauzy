# @gauzy/plugin-ever-stats: anonymous usage statistics

Once a day, an Ever Gauzy API sends Ever Platform one small, signed report about the installation as a whole: which version runs, which modules are switched on, how many tenants, users, employees and projects exist, and monthly totals per currency. The report never contains a name, an e-mail address, a company, an address, a document, a per-record amount or any free text, and its shape is fixed by a published schema, so you can check every byte.

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
| `EVER_STATS_ENABLED=false` | The module is not loaded at all: no route (every `/api/ever-stats/*` answers 404), no timer, no outbound request. |
| Switched off in Settings > Anonymous usage statistics | The module stays loaded so the page keeps working, but the scheduler sends nothing and *Send now* answers 409. |
| The report fails its own checks | It is refused before signing and never sent; the settings page shows which field (never its value). |
| Ever Platform refused a report (`422`, or `409 key_mismatch`) | Nothing more is sent for this module version and identity until the module is upgraded or the identity is reset. |

Only `EVER_STATS_ENABLED=false` switches the module off. Unset, empty or `true` keep it on; any other value (`TRUE`, `1`, ...) keeps the default and logs one warning.

## What is sent

**One call:** `POST {EVER_STATS_API_URL}/v1/stats/reports` (default `https://api.ever.co`).

| | |
|---|---|
| Schedule | Once per UTC day, at a second drawn at random for each report. The first report goes out one day after the first start (ten minutes after a start when the last report is more than a day old). On days 1 to 3 of a month the previous month is sent once more with `final: true`. Several API processes on one database send one report: a lease in the database lets one of them send. |
| Body | One JSON document, `ever.stats.v1`, at most 16 KiB, integers only. The schema is published at `https://api.ever.co/v1/stats/schema`; a copy is in `src/lib/schema/ever.stats.v1.schema.json` (its SHA-256 is in `src/lib/schema/schema-hash.ts`). |
| Headers | `Ever-Stats-Key`: the public part of this installation's statistics key (Ed25519, base64url); `Ever-Stats-Signature: ed25519=<signature over the exact body>`; `Ever-Stats-Key-Id`; `User-Agent: gauzy-ever-stats/<module version> (gauzy/<version>)`. No cookie, no credential, no redirect followed, 10 s timeout. |
| Retries | `202`: done. `429`, `5xx` or a connection error: again after 1 h, 4 h, 12 h, then the next day. `404` (the endpoint is not available) or any other answer: the next day. |

The statistics key is made at first start, stored encrypted in the database, and used for nothing else than signing these reports. Ever Platform remembers the key of an installation id on the first report it accepts, so nobody else can send reports in its name.

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

An example (`src/lib/schema/fixtures/valid/gauzy.json`):

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

The operator of the installation sees: the switch and why nothing is sent, the next report, the last attempt and its HTTP status, *What is sent* (the report as it would be built now; nothing is stored or sent), *Last payload* (the exact bytes sent last time), *Send now* (once per 10 minutes), and *Reset instance identity* (a new `instance_id` and a new statistics key; Ever Platform then counts the installation as new, and earlier reports can no longer be linked to it). The page also warns until `ENCRYPTION_KEY` is set (see `@gauzy/plugin-ever-instance`).

The last 12 reports are kept in the `ever_stats_report` table, with their exact bytes and results.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `EVER_STATS_ENABLED` | on | `false` removes the module (no route, no timer, no request). |
| `EVER_STATS_API_URL` | `EVER_PLATFORM_API_URL`, else `https://api.ever.co` | Where reports go. Plain `http` is accepted only for `localhost`, a private address or a single-label host name (a container), for tests and mirrors. |
| `EVER_STATS_COUNTRY` | `ZZ` | Two-letter country you declare. |
| `EVER_STATS_SERVES` | `gauzy` | `gauzy,teams` when an Ever Teams web app uses this API: the report says so, and `GET /api/ever-stats/state` exists (see below). |
| `EVER_INSTALL_SOURCE` | `self-hosted` | `self-hosted`, `cloud`, `desktop`, `ever.sh`, `works_app` or `partner:<slug>`. The desktop app sets `desktop` for its embedded server. |
| `EVER_OPERATOR_EMAILS` | unset | The operators of the installation (comma separated); see below. |
| `EVER_STATS_SEND_INTERVAL_S` | `86400` | Tests only: shortens the day (every delay scales with it). |

## Who can see the settings

The report covers every tenant of the installation, so only its **operator** can see it or change it. The operator is a super admin who is:

- listed in `EVER_OPERATOR_EMAILS`, when it is set; or
- when it is not set and the installation has a single tenant: that tenant's first super admin (remembered once).

With more than one tenant and no `EVER_OPERATOR_EMAILS`, nobody is the operator until you set it. On an installation declared as Ever's cloud (`EVER_INSTALL_SOURCE=cloud`) nobody is. Everyone else gets 404 from the statistics routes, and the settings page says "Managed by the instance operator" with a link to the published schema, never the payload.

### Routes (all `Cache-Control: no-store`)

| Route | Who |
|---|---|
| `GET /api/ever-stats/status`, `GET /api/ever-stats/last`, `POST /api/ever-stats/preview` | the operator |
| `PUT /api/ever-stats/enabled` `{"enabled": true\|false}`, `POST /api/ever-stats/send-now`, `POST /api/ever-stats/reset-identity` `{"confirm": true}` | the operator |
| `GET /api/ever-stats/state` | anyone, without authentication; it exists only with `EVER_STATS_SERVES` naming `teams` and answers `{"enabled": true\|false}` and nothing else (the Ever Teams server reads it before sending its own version-only report) |

Every route that answers without authentication is declared in `ever-connect.routes.json`; a test fails when the module registers one that is not declared there.

## How to verify yourself

1. Open Settings > Anonymous usage statistics, *What is sent*, and compare it with the schema.
2. Watch the traffic of the API host or container (for example `tcpdump -i any host api.ever.co`): with `EVER_STATS_ENABLED=false` and a restart, no connection is made; switched back on, you see one `POST /v1/stats/reports` a day.
3. Point `EVER_STATS_API_URL` at your own endpoint (for example a local HTTP server that prints the request) and compare the body with *Last payload*: they are the same bytes, and the `Ever-Stats-Signature` verifies with the `Ever-Stats-Key` over exactly those bytes.

## For developers

- Counters: `StatsService.getGlobalStats()` from `@gauzy/core`, called outside any request so they are instance-wide, plus a few `COUNT(*)`/`SUM()` queries for the month (`src/lib/ever-stats-collector.service.ts`).
- The schema, its fixtures and the checks Ever Platform runs (`src/lib/vendor/stats-checks.ts`) are copied from `ever-co/ever-connect-sdk` at commit `2fd74da`. Update them together; `schema.drift.spec.ts` pins both.
- Tests: `yarn nx test plugin-ever-stats`; the database suites (`*.db.spec.ts`) also run on Postgres or MySQL with `EVER_STATS_TEST_POSTGRES_URL` / `EVER_STATS_TEST_MYSQL_URL` (`yarn nx run plugin-ever-stats:test-integration`).
- Tables and migrations: see `MIGRATIONS.md`.
