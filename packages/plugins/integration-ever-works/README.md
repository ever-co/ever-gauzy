<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-integration-ever-works",
      "## Switch it on",
      "## Configure the integration",
      "## API boundary",
      "## How the sync works",
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
codes against the Ever Works integration contract v1 (`/api/integrations/v1`);
its machine-readable form is in the ever-works repository, under
`docs/specs/features/integrations-api-v1/contract/`. This version adds the
connection, the organization mapping and the sync engine; the handlers of the
synced records (people and agents, teams, projects, tasks) follow.

## Switch it on

The plugin is **off by default**. Gauzy is production software, so nothing of
the integration exists unless the operator sets:

```sh
EVER_WORKS_ENABLED=true
```

Only the exact value `true` switches it on. Unset, empty and `false` keep it
off silently; any other value (`TRUE`, `1`, `yes`) keeps it off and logs one
warning. Off, the plugin is not loaded at all by the API or the worker: no
route, no table (its migrations are not even registered), no timer, no catalog
entry and no outbound request.

On, the API runs the plugin's migrations, lists **Ever Works** on the
Integrations page (a catalog row written at start, on every database; never by
the seed) and answers the routes below.

- `EVER_WORKS_API_URL`: the Ever Works API base URL the connect form offers,
  for example `https://api.ever.works/api` for Ever Works Cloud. A public HTTPS
  URL without a query or fragment; anything else is ignored with a warning.
  Unset, the admin types the URL.
- `EVER_WORKS_APP_URL`: the Ever Works web app, for example
  `https://app.ever.works`, used only to link the admin to the page that
  creates an integration key.
- `ENCRYPTION_KEY`: a base64-encoded 32-byte key. The integration key and the
  webhook secret are stored encrypted with it (AES-256-GCM, bound to their
  purpose and connection); a malformed or published value is refused. Without
  it, a strong `JWT_SECRET` that is not a published default is used; with
  neither, nothing can be connected. Secrets stored under the `JWT_SECRET`
  fallback are encrypted again under `ENCRYPTION_KEY` at the next health check
  (daily, or `POST …/connections/:id/health`); the old `JWT_SECRET` can be
  retired after that.
- `API_BASE_URL`: the public HTTPS address of this API, where Ever Works
  delivers webhooks. Without one, no webhook is registered and the change feed
  alone keeps the sync going.
- `EVER_WORKS_WEBHOOK_REQUESTS_PER_MINUTE`: per-process limit of the public
  webhook route (default 1200).
- `EVER_WORKS_SYNC_LOOP=off`: keeps this process out of the sync loop (it still
  serves the API).
- `EVER_WORKS_HEALTH_CHECK=off`: keeps this process out of the daily key check.

## Configure the integration

1. In Ever Works, open **Settings → API keys → New key → Integration**, pin the
   key to the organizations to sync and keep the "Ever Gauzy" scope preset. The
   key starts with `ew_int_` and is shown once.
2. In Gauzy, connect the tenant with the API URL and the key
   (`POST …/connections`). Gauzy checks the key with `whoami`, refuses an
   incompatible API version, lists missing scopes and stores the key encrypted.
3. Register the webhook (`POST …/connections/:id/webhook`); the change feed is
   followed either way.
4. Map each Gauzy organization to one pinned Ever Works organization
   (`POST …/mappings`). Mapping seeds the organization's "Idea" issue type and
   "Ideas" view; the "Ever Works" and "Ever Works — Ideas" projects are created
   when they are first needed.

A revoked or expired key turns the connection `needs_reauth`: the sync pauses
and the admin who connected gets a notification. Entering a new key of the same
Ever Works tenant resumes it. Disconnecting archives the connection and its
mappings and deletes the Ever Works webhook; links and logs are kept, so a
reconnect resumes without duplicates. Nothing synced is deleted on either side.

## API boundary

Management routes use the signed-in Gauzy user, tenant permissions, integration
permissions and an active membership of the organization (`organizationId`
query parameter). The tenant always comes from the request context. Permissions
below use the `INTEGRATION_` prefix; paths share the
`/api/integration/ever-works` prefix.

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
| GET | `/mappings/:integrationTenantId/people` | `VIEW` |
| PUT | `/mappings/:integrationTenantId/people` | `EDIT` |
| GET | `/mappings/:integrationTenantId/agents` | `VIEW` |
| POST | `/mappings/:integrationTenantId/agents/import` | `EDIT` |
| DELETE | `/mappings/:integrationTenantId` | `DELETE` |

Keys are write-only: no response carries the integration key or the webhook
secret, and connection responses are `Cache-Control: no-store`.

`POST /webhooks/:connectionId` is public and rests on the signature alone:
`X-Ever-Works-Signature` (`t=<unix>,v1=<hex HMAC-SHA256(secret,
"<t>.<raw body>")>`, 300 s tolerance, the contract's shared test vectors pass)
is verified over the raw bytes with the connection's own secret, after a
per-process rate limit. The tenant and organization come from the stored
connection and mapping, never from the payload; an event of another Ever Works
tenant is refused. Accepted events are stored once (deduplicated on their id)
and answered `202`.

## How the sync works

- **Intake.** Webhooks and the change feed (`/events`, our own origin excluded)
  store events in `ever_works_inbound_event`; the feed is polled every minute
  while webhooks are quiet, every ten minutes otherwise. An expired cursor
  (`410`) requests a resync.
- **Apply.** Pending events are applied per aggregate in `seq` order, inside
  `EverWorksSyncContext` (loop guard 1). Events of our own origin are skipped
  (loop guard 3); events of a kind no handler covers yet are deferred, not lost.
- **Capture and push.** Gauzy changes (`TaskEvent`, and the entity subscribers
  of later items) become one coalesced `ever_works_outbound_change` per record;
  the pusher recomputes the state, diffs it against the link snapshot (loop
  guard 2) and retries 429/5xx with back-off, dead-lettering after eight tries.
- **Merge.** Per field, against the snapshot: one side changed wins; both
  changed → last writer wins for scalars and rich text (the loser is kept), a
  3-way set merge for sets; Ever Works' gates decide status.
- **People.** Ever Works members are paired with Gauzy people on the People
  tab: a verified, case-insensitive email match is only a suggestion the admin
  confirms (one by one or all at once); nothing is linked silently and
  unlinking removes only the pairing. Ever ID matching waits for Gauzy to
  store Ever ID subjects.
- **Agents.** Each Ever Works agent of a mapped organization becomes a Gauzy
  employee of kind `agent` (created through the platform's agent path: no
  password, no invite, an `@agents.invalid` address) with a profile managed by
  Ever Works. The sync is one way: an archived or deleted agent is archived,
  a private one is unlinked, and Gauzy edits to it are not pushed.
- **Runtime.** Every process that loads the plugin ticks; a database lease on
  the connection row lets one process work a connection at a time, on every
  database, with or without Redis. A daily `whoami` checks every key.

## Build and verification

```sh
yarn nx build plugin-integration-ever-works
yarn nx build plugin-integration-ever-works-ui --configuration=production
yarn nx test plugin-integration-ever-works
yarn nx test plugin-integration-ever-works-ui
```

The suites run the plugin's migrations on SQLite and its services against the
mock Ever Works server (`src/lib/testing/mock-ever-works.server.ts`, test code
that is not part of the package build).

Both packages participate in the workspace and Docker builds. The backend is
listed, behind `EVER_WORKS_ENABLED`, in the API and worker plugin lists and
packaged into the API and worker images. The Angular package is registered in
the web application and excluded from backend runtime package copies. The
desktop, server and server-api manifests include the backend package.
