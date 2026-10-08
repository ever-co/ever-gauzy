<!-- cspell:words pcaps -->

# Egress audit

A runtime proof of what the anonymous usage statistics module (`@gauzy/plugin-ever-stats`) may send:
**nothing at all** when it is switched off, and **only the statistics report** when it is on.

The audit runs the Gauzy API image with a throw-away PostgreSQL on Docker networks that have no route out.
CoreDNS is the API's only resolver and logs every query; a `tcpdump` sniffer in the API's network
namespace starts before the API and records every connection attempt and DNS question. A run fails
when the API looks up an Ever host (or any name outside the compose services), tries to reach
anything outside the sealed networks, answers a statistics route while the module is off, or makes a
call its mode does not allow.

## The harness

The harness is the egress audit of the Ever Platform SDK's dev tools, the `ever-egress-audit` of
[`@ever-co/connect-tools`](https://www.npmjs.com/package/@ever-co/connect-tools) (Apache-2.0), with its
mock platform. It is not copied here: the workflow installs the exact version the statistics plugin
pins (`devDependencies` of `packages/plugins/ever-stats/package.json`) from npm for the run. The
config sets a private `subnet`, so the mock's address on the sealed network (`__MOCK_URL__`) is a
local address the module accepts over plain http.

This directory holds only Gauzy's inputs:

- `egress-audit.config.json`: the compose file, the API service, the statistics routes probed in the
  off modes, and the Gauzy mode `off_env_file`;
- `adapter.mjs`: in the off modes, calls every statistics route with its own method (the harness's
  probe sends GET only) and requires 404 from each; it also points the module at an address on the
  audit network and serves `teams`, so a module loaded by mistake would answer its public route and
  try to send within the watched window;
- `compose.egress-audit.yml`: the API image under test (`GAUZY_API_IMAGE`) and a PostgreSQL, a
  random secret per run (`GAUZY_AUDIT_SECRET`), the API's `.env.local` of the mode
  (`GAUZY_AUDIT_DOTENV`) and no published port.

## Modes

| Mode | The API | Passes when |
|---|---|---|
| `off` | `EVER_STATS_ENABLED=false` in the container environment | no Ever host looked up, no connection attempt out, `/api/ever-stats/*` 404 |
| `off_env_file` | the same switch written ONLY in the API's `.env.local` (its working directory) | the same |
| `positive_stats` | module on, `EVER_STATS_API_URL` = the mock platform | reports accepted (`202`), and no call but the statistics report |
| control | `positive_stats` with the mock platform left out | must **fail** (exit 1): a green run is not a blind one |

"Switched off in Settings" (module loaded, no call at all, *Send now* answers 409) is proven by the
plugin's suite against the same mock platform (`yarn nx run plugin-ever-stats:test-mock-platform`),
which `build-api` runs on every develop push.

## Running it

`.github/workflows/egress-audit.yml` runs it on a GitHub-hosted runner every day on the newest
published develop API image, and on demand (`gh workflow run egress-audit.yml -f image=<image>`).
Locally, with Docker and the workspace installed (`@ever-co/connect-tools` is a devDependency):

```sh
: > /tmp/api-empty.env
GAUZY_AUDIT_SECRET=$(openssl rand -hex 32) GAUZY_API_IMAGE=ghcr.io/ever-co/gauzy-api-demo:latest GAUZY_AUDIT_DOTENV=/tmp/api-empty.env \
  node node_modules/@ever-co/connect-tools/dist/egress-audit/run.mjs --config tools/egress-audit/egress-audit.config.json --mode off
```

The evidence (`report.json`, the pcaps, the DNS log, the API log and the mock's call record per
mode) lands in `egress-audit-artifacts/`.
