<!-- cspell:words pcaps -->

# Egress audit

A runtime proof of what the optional Ever Platform modules (`@gauzy/plugin-ever-stats`, the
anonymous usage statistics, and `@gauzy/plugin-ever-connect`, the connection) may send:
**nothing at all** when they are switched off or loaded but idle, and **only the statistics report**
when the statistics are on. Both are off on a self-hosted install unless an operator turns them on.

The audit runs the published Gauzy API and web app images with a throw-away PostgreSQL on Docker
networks that have no route out. CoreDNS is the only resolver and logs every query; a `tcpdump`
sniffer in the API's network namespace starts before the API and records every connection attempt
and DNS question. A run fails when the API looks up an Ever host (or any name outside the compose
services), tries to reach anything outside the sealed networks, answers a statistics route while the
module is off, or makes a call its mode does not allow.

The **browser leg** does the same for the web app: a real browser, in its own sniffed namespace with
the same resolver, signs in as the seeded Super Admin through the real sign-in page, opens every
route of the Angular router and holds the settings and integrations pages open. It fails when the
browser looks up or requests an Ever host, or when a page renders a link to one that is not in the
baseline of links that predate the modules.

## The harness

The harness is the egress audit of the Ever Platform SDK's dev tools, the
`ever-egress-audit` of [`@ever-co/connect-tools`][connect-tools] (Apache-2.0),
with its mock platform. It is not copied here: `package.json` and
`package-lock.json` in this directory pin it (with the `typescript` its Angular
route generator reads the router with), and the workflow installs them with
`npm ci`. This directory is not a workspace of the monorepo. The config pins
the sealed network to a fixed private `subnet`, so the mock's address on it
(`__MOCK_URL__`) is a local address the module accepts over plain http.

[connect-tools]: https://www.npmjs.com/package/@ever-co/connect-tools

This directory holds only Gauzy's inputs:

- `egress-audit.config.json`: the compose file, the API and web app services, the statistics routes
  probed in the off modes, the browser leg's settings and the Gauzy mode `off_env_file`;
- `adapter.mjs`: signs in as the seeded Super Admin (through the API for the ids the browser needs,
  never a token; through the sign-in page for the browser, after the pages a person sees signed
  out); in the off modes calls every statistics route with its own method and requires
  404 from each; in `loaded_off` switches the statistics off in Settings as the operator; points the
  statistics at an address on the audit network with a short day, so a module that sends when it
  should not is seen within the watched window;
- `compose.egress-audit.yml`: the images under test (`GAUZY_API_IMAGE`, `GAUZY_WEBAPP_IMAGE`) and a
  PostgreSQL, a random secret per run (`GAUZY_AUDIT_SECRET`), the API's `.env.local` of the mode
  (`GAUZY_AUDIT_DOTENV`), seeded accounts under `example.com` and no published port. The web app gets
  only the API's address and its own; every other setting keeps the image's default;
- `ui-routes.json`: the routes the browser opens, generated from the Angular router; routes that UI
  plugins register at run time are listed by hand (`"source": "manual"`) and kept when it is
  generated again;
- `route-params.json`: values for route parameters (the adapter adds the seeded ids);
- `ui-baseline.json`: the links to Ever hosts the web app rendered before the modules (the product
  site, legal pages, downloads), recorded with both modules off from `base_commit`. It may only
  shrink, and an entry excuses that one link on that one route, never a lookup or a request.

`allowed_external_hosts` names the third-party hosts the web app reaches by default whatever the
modules do, none of them Ever's: Google Fonts (`fonts.googleapis.com`, the fonts' stylesheet), Google
Maps (`maps.googleapis.com`, the maps script), OpenStreetMap tiles (`a.`, `b.`,
`c.tile.openstreetmap.org`, the location maps), `dummyimage.com` (placeholder images of records
without one) and `github.com` (the GitHub integration page opens the GitHub App installation). They
may be looked up (in the sealed networks they reach nothing); an Ever host can never be allowed.

The web app routes in the URL fragment (`/#/pages/...`), so the config says `"ui_routing": "hash"`
(with `web_url` the bare address) and the browser opens each route as
`http://webapp:4200/#/<route>`. The harness signs the walk in through the adapter's `uiLogin` and
checks that the sign-in holds: `ui_sign_in_route` (`/auth/login`) is the sign-in page, and a route
that ends on it faults the run.

## Modes

| Mode | The API | Browser leg | Passes when |
|---|---|---|---|
| `off` | `EVER_STATS_ENABLED=false`, connection unset | yes | no Ever host looked up or requested, no connection attempt out, `/api/ever-stats/*` 404, no Ever link outside the baseline |
| `off_env_file` | the statistics switch written ONLY in the API's `.env.local` (its working directory) | no | the same, for the API |
| `loaded_off` | both modules loaded: statistics on by configuration and switched off by the operator in Settings, connection on and not connected | yes | no call at all, in both legs |
| `positive_stats` | statistics on, `EVER_STATS_API_URL` = the mock platform | yes | reports accepted (`202`), no call but the statistics report; the browser's settings page asks the API for the statistics status |
| control | `positive_stats` with the mock platform left out | yes | must **fail** (exit 1): a green run is not a blind one |
| `every_trigger` | both modules on against the mock platform; the adapter fires every trigger of every call (connect with `EVER_CONNECT_CODE`, link, entitlement refresh unchanged and new, a consent and the operator's accept, the statistics link, switching off, unlink, disconnect; the report goes out by itself) | no | the calls made are **exactly** the Gauzy rows of the contract this release makes, row for row; the rows it does not make (`every_trigger_exclude_rows`, kept equal to the "not made" table of [the list of outbound calls](../../docs/ever-platform/outbound-calls.md) by a check) are never called |
| `connect_off_sign_in_on` | connection off, statistics off, the Ever ID sign-in plugin on (`ZITADEL_ENABLED=true`) with an issuer on an Ever host | yes | the plugin leaves the issuer unused on a self-hosted installation: no Ever host looked up or requested, no redirect to it, `/api/ever-stats/*` 404 |
| `entitlement_ladder` | connection on against the mock platform; the mock's clock moves so its documents are issued 600 s in the future, expired a day ago, expired 31 days ago, 200 s ahead | no | the future one is refused and the stored one kept; the others are stored and the ladder reads `grace`, `paused` (every feature off), `valid`; Gauzy's own routes (health, sign-in, the user, the organization, projects, invoices, time logs, contacts) answer the same at every step; only the connection's documented calls |
| static-bundle | the web app image's built files | - | no Ever host the baseline's `bundle` list does not have |

## Running it

`.github/workflows/egress-audit.yml` runs each mode as its own job on a GitHub-hosted runner every
day on the newest published develop images, on demand (`gh workflow run egress-audit.yml -f
image=<api image> -f webapp_image=<web app image>`) and on pull requests that change its inputs. On
every pull request that changes the UI's routes it also checks that `ui-routes.json` is in step with
the router and that `ui-baseline.json` only shrank.

Locally, with Docker:

```sh
npm ci --prefix tools/egress-audit --ignore-scripts
: > /tmp/api-empty.env
GAUZY_AUDIT_SECRET=$(openssl rand -hex 32) GAUZY_AUDIT_DOTENV=/tmp/api-empty.env \
  GAUZY_API_IMAGE=ghcr.io/ever-co/gauzy-api-demo:latest GAUZY_WEBAPP_IMAGE=ghcr.io/ever-co/gauzy-webapp-demo:latest \
  node tools/egress-audit/node_modules/@ever-co/connect-tools/dist/egress-audit/run.mjs \
  --config tools/egress-audit/egress-audit.config.json --mode off

# the route list against the router (exits 1 naming a route the list lacks)
node tools/egress-audit/node_modules/@ever-co/connect-tools/dist/egress-audit/run.mjs ui-routes \
  --framework angular --entry apps/gauzy/src/app/app.routes.ts --out tools/egress-audit/ui-routes.json --check
```

## Static checks

Run on every pull request that touches code, with nothing installed but the harness:

- `node tools/egress-audit/static-hostnames.mjs`: no file outside the Ever Platform modules (their
  packages, their docs, this directory, tests and prose) names an Ever host (the `ever_owned`
  names of the harness's never-allowed list and every name under them) or `EVER_PLATFORM_API_URL` /
  `EVER_STATS_API_URL` more often than `static-hostnames.baseline.json` records. The baseline holds
  what Gauzy named before the modules (the product site, documentation, demo accounts, downloads);
  it may only shrink (`--check-shrink <the file at the base>`), and `--write` refuses to grow it. With
  `--bundle <dir>` the same scan reads a built web app (the `/srv/gauzy` of the web app image)
  against the baseline's `bundle` hosts; the `static-bundle` job does it on the image under test.
- `node tools/ever-platform/check-import-boundary.mjs`: only the modules and the two plugin lists
  import a module, through its entry point; the statistics never import the connection or an
  analytics plugin, the instance identity no HTTP client, the connection and the sign-in plugin
  never each other, a web part never a server module, and the connection's entry point exports no
  entitlement code. The same rules are the ESLint rule `ever-platform/import-boundary` of the root
  `eslint.config.js` (`tools/ever-platform/import-boundary.cjs`).
- `node tools/ever-platform/outbound-calls.mjs --check`: the tables of
  [`docs/ever-platform/outbound-calls.md`](../../docs/ever-platform/outbound-calls.md) are the pinned
  contract's rows for what Gauzy makes (`--write` regenerates them), the connection README's request
  table names exactly those rows and their requests, the statistics README its request, the audit
  excludes exactly the rows Gauzy does not make, and the harness and the modules pin one contract
  version.

Each has a known-bad fixture its test (`*.test.mjs`, `node --test`) requires to fail.

The evidence (`report.json`, the pcaps, the DNS log, the API log, the mock's call record, and for
the browser leg the HAR without cookies, header values or bodies, the requests, the rendered links
and the visited routes) lands in `egress-audit-artifacts/<mode>/`.
