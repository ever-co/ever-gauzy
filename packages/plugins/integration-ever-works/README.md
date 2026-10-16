<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-integration-ever-works",
      "## Switch it on",
      "## Configure the integration",
      "## API boundary",
      "## Build and verification"
    ]
  }
}
-->

# @gauzy/plugin-integration-ever-works

Two-way integration between an Ever Gauzy tenant and an
[Ever Works](https://ever.works) tenant. Once connected, tasks, teams, goals,
missions, ideas, docs, agents and an inbox sync in both directions: what Ever
Works agents work on is visible in Gauzy (and through Gauzy in Plane and Ever
Teams), and what people do in Gauzy is visible to agents and people in Ever
Works.

The design lives in the integration plan (homelab repository,
`docs/superpowers/specs/2026-10-15-gauzy-ever-works-integration/`). This package
is built in steps; this version is the scaffold: the switch, the catalog entry
and the status route. The connection (an Ever Works integration key), the
organization mapping and the sync engine follow.

## Switch it on

The plugin is **off by default**. Gauzy is production software, so nothing of
the integration exists unless the operator sets:

```sh
EVER_WORKS_ENABLED=true
```

Only the exact value `true` switches it on. Unset, empty and `false` keep it
off silently; any other value (`TRUE`, `1`, `yes`) keeps it off and logs one
warning. Off, the plugin is not loaded at all by the API or the worker: no
route, no table, no timer, no catalog entry and no outbound request.

On, the API lists **Ever Works** on the Integrations page (a catalog row written
at start, on every database; never by the seed or a migration) and answers the
routes below.

Optional settings, read once at start:

- `EVER_WORKS_API_URL`: the Ever Works API base URL the connect form offers,
  for example `https://api.ever.works/api` for Ever Works Cloud. A public HTTPS
  URL without a query or fragment; anything else is ignored with a warning.
  Unset, the admin types the URL.
- `EVER_WORKS_APP_URL`: the Ever Works web app, for example
  `https://app.ever.works`, used only to link the admin to the page that
  creates an integration key.

## Configure the integration

1. In Ever Works, open **Settings → API keys → New key → Integration**, pin the
   key to the organizations to sync and keep the "Ever Gauzy" scope preset. The
   key starts with `ew_int_` and is shown once.
2. In Gauzy, select the organization and open **Integrations → Ever Works**.
3. Enter the Ever Works API URL and the key, validate, map the organizations,
   review the matches and start the initial sync.

Steps 2 and 3 arrive with the connection (G-P1-3) and the connect page
(G-P1-11). The key is stored encrypted (AES-256-GCM under `ENCRYPTION_KEY`),
never in the plaintext integration settings.

## API boundary

Management routes use the signed-in Gauzy user, tenant permissions and
integration permissions. Permissions below use the `INTEGRATION_` prefix. Paths
share the `/api/integration/ever-works` prefix.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/status` | `VIEW` |

Status answers only where the plugin is loaded, so the web app tells from a 404
that the integration is switched off. It returns the plugin and contract
versions and the URLs the connect form offers, with `Cache-Control: no-store`.

## Build and verification

```sh
yarn nx build plugin-integration-ever-works
yarn nx build plugin-integration-ever-works-ui --configuration=production
yarn nx test plugin-integration-ever-works
yarn nx test plugin-integration-ever-works-ui
```

Both packages participate in the workspace and Docker builds. The backend is
listed, behind `EVER_WORKS_ENABLED`, in the API and worker plugin lists and
packaged into the API and worker images; the worker will host the sync
schedules. The Angular package is registered in the web application and
excluded from backend runtime package copies. The desktop, server and
server-api manifests include the backend package.
