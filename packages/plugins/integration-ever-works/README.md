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
`docs/superpowers/specs/2026-10-15-gauzy-ever-works-integration/`). The plugin
codes against the Ever Works integration contract v1 (`/api/integrations/v1`,
machine-readable in ever-works
`docs/specs/features/integrations-api-v1/contract/`). This version adds the
connection and the organization mapping; the sync engine follows.

## Switch it on

The plugin is **off by default**. Gauzy is production software, so nothing of
the integration exists unless the operator sets:

```sh
EVER_WORKS_ENABLED=true
```

Only the exact value `true` switches it on. Unset, empty and `false` keep it
off silently; any other value (`TRUE`, `1`, `yes`) keeps it off and logs one
warning. Off, the plugin is not loaded at all by the API or the worker: no
route, no table (its migration is not even registered), no timer, no catalog
entry and no outbound request.

On, the API runs the plugin's migration (`ever_works_connection`), lists
**Ever Works** on the Integrations page (a catalog row written at start, on
every database; never by the seed) and answers the routes below.

| Variable | Meaning |
| --- | --- |
| `EVER_WORKS_API_URL` | The Ever Works API base URL the connect form offers, for example `https://api.ever.works/api` for Ever Works Cloud. Public HTTPS without a query or fragment; anything else is ignored with a warning. |
| `EVER_WORKS_APP_URL` | The Ever Works web app, for example `https://app.ever.works`, used only to link the admin to the page that creates an integration key. |
| `ENCRYPTION_KEY` | A base64-encoded 32-byte key. The integration key and the webhook secret are stored encrypted with it (AES-256-GCM, bound to their purpose and connection); a malformed or published value is refused. Without it, a strong `JWT_SECRET` that is not a published default is used; with neither, nothing can be connected. |
| `API_BASE_URL` | The public HTTPS address of this API, where Ever Works delivers webhooks. Without one, no webhook is registered (the change feed still works). |
| `EVER_WORKS_HEALTH_CHECK=off` | Keeps this process out of the daily key check. |

## Configure the integration

1. In Ever Works, open **Settings → API keys → New key → Integration**, pin the
   key to the organizations to sync and keep the "Ever Gauzy" scope preset. The
   key starts with `ew_int_` and is shown once.
2. In Gauzy, validate the key (`POST …/connections/validate`) and connect the
   tenant with the API URL and the key (`POST …/connections`). Gauzy checks the
   key with `whoami`, refuses an incompatible API version, lists missing scopes
   and stores the key encrypted. Personal Ever Works keys (`ew_live_…`) are
   refused.
3. Register the webhook (`POST …/connections/:id/webhook`): every domain of the
   catalog, the pinned organizations, Gauzy's own origin excluded. The signing
   secret Ever Works returns once is stored encrypted.
4. Map each Gauzy organization to one pinned Ever Works organization
   (`POST …/mappings`): one `integration_tenant` named `Ever_Works` per mapped
   organization, with the entity directions (defaults of the plan), the default,
   Ideas and Docs targets, the include flags and one sync toggle per entity
   (`integration_entity_setting`). Mapping seeds the organization's "Idea" issue
   type and "Ideas" view; the "Ever Works" and "Ever Works — Ideas" projects are
   created through the platform's own project command when first needed
   (`POST …/mappings/:id/projects/default|ideas`). Each side of a pair is mapped
   once per tenant; unmapping archives the mapping, and mapping the same pair
   again resumes it.

A revoked or expired key turns the connection `needs_reauth` (the daily check
or any call that gets a 401): the sync pauses and the admin who connected gets
a notification (an employee notification until the Gauzy Inbox exists).
Entering a new key of the same Ever Works tenant (`PUT …/connections/:id/key`)
resumes it. Disconnecting archives the connection and its organization
mappings and deletes the Ever Works webhook on a best-effort basis; links and
logs are kept, so a reconnect to the same Ever Works tenant resumes the same
connection. Nothing synced is deleted on either side.

## API boundary

Management routes use the signed-in Gauzy user, tenant permissions, integration
permissions and an active membership of the organization (`organizationId`
query parameter). The tenant always comes from the request context; one
connection per tenant. Permissions below use the `INTEGRATION_` prefix; paths
share the `/api/integration/ever-works` prefix.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/status` | `VIEW` |
| GET | `/connections` | `VIEW` |
| POST | `/connections/validate` | `ADD` |
| POST | `/connections` | `ADD` |
| GET | `/connections/:id` | `VIEW` |
| PUT | `/connections/:id/key` | `EDIT` |
| POST | `/connections/:id/pause` | `EDIT` |
| POST | `/connections/:id/resume` | `EDIT` |
| POST | `/connections/:id/health` | `EDIT` |
| POST | `/connections/:id/webhook` | `EDIT` |
| DELETE | `/connections/:id` | `DELETE` |
| GET | `/mappings` | `VIEW` |
| POST | `/mappings` | `ADD` |
| PUT | `/mappings/:integrationTenantId` | `EDIT` |
| POST | `/mappings/:integrationTenantId/projects/default` | `EDIT` |
| POST | `/mappings/:integrationTenantId/projects/ideas` | `EDIT` |
| DELETE | `/mappings/:integrationTenantId` | `DELETE` |

Keys are write-only: no response carries the integration key or the webhook
secret, and every connection response is `Cache-Control: no-store`. Ever Works
failures are answered as 400 / 502 / 503 with the contract's error code, never
as 401 (which would sign the Gauzy user out).

Calls to Ever Works go through the SSRF-safe HTTPS agent (every resolved address
must be public), without redirects or a proxy, with a 15 s timeout and a 10 MiB
response cap. They carry `X-Sync-Origin: gauzy:<connectionId>` on writes, an
`Idempotency-Key` on every create, `X-Scope-Slug` where a pinned organization is
meant, and retry 429 and 5xx with back-off and jitter, honouring `Retry-After`.

## Build and verification

```sh
yarn nx build plugin-integration-ever-works
yarn nx build plugin-integration-ever-works-ui --configuration=production
yarn nx test plugin-integration-ever-works
yarn nx test plugin-integration-ever-works-ui
```

The suites run the plugin's migration on SQLite and its services against the
mock Ever Works server (`src/lib/testing/mock-ever-works.server.ts`, test code
that is not part of the package build), with the contract's fixtures in
`src/lib/testing/contract/`.

Both packages participate in the workspace and Docker builds. The backend is
listed, behind `EVER_WORKS_ENABLED`, in the API and worker plugin lists and
packaged into the API and worker images. The Angular package is registered in
the web application and excluded from backend runtime package copies. The
desktop, server and server-api manifests include the backend package.
