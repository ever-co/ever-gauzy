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
and the admin who connected gets a notice. Entering a new key of the same
Ever Works tenant resumes it. Disconnecting archives the connection and its
mappings and deletes the Ever Works webhook; links and logs are kept, so a
reconnect resumes without duplicates. Nothing synced is deleted on either side.

Where the Gauzy Inbox is loaded (`GAUZY_INBOX_ENABLED=true`), the notices are
Inbox items (`NOTICE`, `source = SYSTEM`), one per connection, admin and kind
of notice: `needs_reauth`, and `dead_letter` for a change that stopped for good
(it names the latest record). A repeat updates the notice and marks it unread
again. Without the Inbox, `needs_reauth` falls back to an employee notification
for the admin's employee, and dead letters show only in the sync activity.

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
| GET | `/mappings/:integrationTenantId/teams` | `VIEW` |
| PUT | `/mappings/:integrationTenantId/teams` | `EDIT` |
| GET | `/mappings/:integrationTenantId/projects` | `VIEW` |
| PUT | `/mappings/:integrationTenantId/projects` | `EDIT` |
| GET | `/mappings/:integrationTenantId/initiatives` | `VIEW` |
| PUT | `/mappings/:integrationTenantId/initiatives` | `EDIT` |
| GET | `/mappings/:integrationTenantId/sync/status` | `VIEW` |
| GET | `/mappings/:integrationTenantId/sync/preview` | `VIEW` |
| POST | `/mappings/:integrationTenantId/sync/start` | `EDIT` |
| POST | `/mappings/:integrationTenantId/sync/resync` | `EDIT` |
| POST | `/mappings/:integrationTenantId/sync/cancel` | `EDIT` |
| GET | `/mappings/:integrationTenantId/sync/runs` | `VIEW` |
| GET | `/mappings/:integrationTenantId/sync/log` | `VIEW` |
| GET | `/mappings/:integrationTenantId/conflicts` | `VIEW` |
| POST | `/mappings/:integrationTenantId/conflicts/:id/resolve` | `EDIT` |
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
- **Teams.** Existing teams are paired on the Teams tab (same-name
  suggestions the admin confirms, or "create on the other side"); teams
  created after the mapping sync without a review. Creating on the other side
  needs the mapping enabled and a teams direction that writes there; a Gauzy
  team suggested for several Ever Works teams is paired one by one. Names and emoji sync both
  ways; members sync as a set (adds and removes against the snapshot, lead ↔
  manager) and members either side cannot map are kept. Ever Works nesting
  stays on the link (Gauzy teams are flat). A team deleted in Ever Works is
  archived in Gauzy; a Gauzy team delete is not pushed.
- **Projects ↔ works (link only).** The Projects tab pairs them (same-URL
  or same-name suggestions, or a project created from a work); nothing is
  paired silently. For a pair, what changes in Ever Works is written to the
  project: name, description, website, primary repository, status (archived →
  archived), members (owner/manager → manager) and teams. Nothing is pushed;
  the kind and every repository URL stay on the link. Members and teams paired
  later join the project through the sync loop's sweep. Private works are not
  listed and never sync. Creating a project from a work needs the mapping
  enabled and works not switched off.
- **Create in Ever Works (G-P2-5).** On the same tab (`createInEverWorks` on
  `PUT …/projects`), an admin opts a Gauzy project in: it becomes a repo-less
  Ever Works work of kind `project`, with the project's name, description and
  website, its teams as its scope (a team not paired yet refuses the create),
  owned by the admin's paired Ever Works user, and linked like any pair. Ever
  Works must have project works switched on
  (`EVER_WORKS_PROJECT_WORKS_ENABLED=true` there); otherwise, or when Ever
  Works refuses, the reason is returned in `failures` and nothing is linked.
  A retry never creates a second work. Gauzy never creates a work on its own.
- **Tasks.** Both ways, through Gauzy's own task commands (numbering,
  sanitizing, subscriptions and other integrations behave as for any task
  write), attributed to the mapped person or agent, else to the admin who
  connected. Title (cut to 200 in Ever Works, the full title in the
  description), description (Markdown ↔ rich HTML), status (the task's own
  status set by slug, then by flag; Ever Works' gates decide, and a refused move
  puts Ever Works' status back with a comment), priority, labels ↔ tags,
  parent, teams (the scope), assignees ↔ members (agents included), watchers ↔
  manual subscriptions (people), and blockers and relations ↔ linked issues
  (written as a pair on both Gauzy tasks; `follow-up` is "relates to", the kind
  kept on the link; a bulk delete is caught by a 10-minute sweep). Task chat ↔
  task comments: an agent's message is a comment by its agent employee
  (`Agent` actor), a Gauzy comment is posted as its author (cut to 16384
  characters); Ever Works lets only the author edit, a person for 5 minutes, so
  a later Gauzy edit is logged, not pushed. The Gauzy task links to its Ever
  Works page and, once there is one, its pull request. Due and start dates and
  the estimate sync too (Gauzy seconds ↔ Ever Works minutes; a start after the
  due date is not sent, as Ever Works refuses it). Each
  side is compared with its own last-synced value, so a value the other side
  cannot hold exactly (p2 and p3 are both medium) never flaps; when both sides
  changed a field the later edit wins, and a lost description is kept as a
  comment. An Ever Works task lands in its work's project, else the Ideas
  project for an idea's task, else the only project of its mission's initiative,
  else the default "Ever Works" project. A delete in Ever Works soft-deletes
  the Gauzy task; a Gauzy delete cancels the Ever Works task with a comment.
  Private tasks, recurring templates, Idea tasks (synced as ideas) and, unless
  the setting is on, triage tasks are not synced. Task writes need a process
  that serves the API (it has the request context the task commands read);
  where the worker also runs the plugin, set `EVER_WORKS_SYNC_LOOP=off` there.
- **Ideas ↔ Idea tasks (G-P2-3).** An Ever Works idea is a Gauzy task of
  the organization's "Idea" issue type in the "Ever Works — Ideas" project
  (created when first needed): title, description (plain text, escaped),
  status (pending → open, queued/building → in progress, accepted → done,
  dismissed → cancelled, failed → blocked with the failure as a comment),
  teams and a `source:<value>` tag; only what changed in Ever Works is
  written. A Gauzy Idea task becomes an Ever Works idea (always `external`
  and `pending`); title, description and teams are patched, cancelling it
  dismisses the idea and reopening restores it. Accepting and building stay in
  Ever Works: no other status move is pushed, and a refused move writes Ever
  Works' status back. A task whose type changes away from Idea is unlinked
  (both kept); a deleted idea archives its task; private ideas never sync.
- **Goals ↔ Goal + key results (G-P2-1).** An Ever Works goal is a Gauzy
  goal: title, description, deadline (the narrowest active time frame that
  contains it, else a new `Q<n> <yyyy>` time frame), scope (its first team →
  level Team, no team → Organization; a Gauzy Employee goal stays one), lead
  (its agent, else its owner), progress, archived and the primary mission's
  initiative. Criteria, a metric and the Definition of Done become key results
  (numeric with bucketed weights, True/False for Definition-of-Done items); a
  key result Ever Works drops is archived. A Gauzy goal becomes an Ever Works
  goal that is **always a draft** (numeric key results → a metric goal on the
  external source, else a delivery goal from its True/False key results);
  edits, criteria and the Definition of Done follow, and key result values are
  pushed as samples (`POST /goals/:id/samples`). Gauzy never activates,
  resumes or completes an Ever Works goal: no status is sent.
- **Missions ↔ strategic initiatives (G-P2-2).** The Initiatives tab
  (`GET`/`PUT …/initiatives`) pairs missions and initiatives (same-title
  suggestions the admin confirms, or "create on the other side"); missions
  and initiatives created after the mapping pair without a review. From Ever
  Works: title, description → intent, status (active → active, paused →
  active with momentum "stalled", completed/failed → resolved with the
  outcome in the strategic notes), owner → steward, teams (scope team or
  organization), works → projects and the primary goals → the goals'
  initiative. To Ever Works (only with the missions direction `both`): a
  mission Ever Works creates **paused**, then title, intent, teams, works and
  goals; resolving or retiring the initiative completes the mission. Gauzy
  never activates a mission. Drafts wait until active, and **leadership
  initiatives never sync** (one that turns leadership stops syncing, flagged).
- **Scope.** A record on a team is team-scoped on both sides, on no team
  organization-scoped: team resources set the team of the linked project or
  task, a record whose Gauzy team is not linked yet waits, and private Ever
  Works records never sync.
- **Initial sync and resync.** `GET …/sync/preview` is the dry run: per phase,
  the records on each side, the pairs still to make on their tab and what a
  run would create; it writes nothing. `POST …/sync/start` records the change
  feed's head and starts a run (`ever_works_sync_run`, one running run per
  mapping) that the sync loop advances under the connection's lease, phase by
  phase: members (mapping only), agents, teams, works, missions, goals, ideas,
  tasks (parents first), task edges (in the task records), comments (the last
  200 per synced task), inbox, docs. A phase reads its list route page by
  page and stores every record as an initial event that the record type's
  handler applies like a live one, then queues the Gauzy records in scope for
  Ever Works where its direction writes there; the next phase starts once
  those records are applied. Each sweep works within a time budget and saves
  the phase's checkpoint after every page, so a run resumes where it stopped,
  in whichever process holds the connection; a cancelled run stops at its next
  checkpoint; a phase whose handler is
  not part of this version is skipped and picked up by a later resync. At the
  end, feed events after the head that were skipped meanwhile are applied
  again (anything a link's version covers is skipped). `POST …/sync/resync` is
  the same run as a reconcile pass; an expired feed cursor (`410`) starts one
  on its own.
- **Observability.** `GET …/sync/status` returns the lag (Ever Works' feed
  head against what Gauzy read and applied), the inbound and outbound counts
  (pending, deferred, failed, dead), the open conflicts, the last error, the
  link totals per type and the latest runs. `GET …/sync/log` pages the sync
  log (filters: status, direction, record type). Conflicts are log entries
  with both values and the winner, kept until resolved: `keep`, or
  `use_other`, which writes the other side's value into the Gauzy record
  through the platform (a task through its update command) as the signed-in
  admin, so the change is pushed to Ever Works like any Gauzy edit.
- **Runtime.** Every process that loads the plugin ticks; a database lease on
  the connection row lets one process work a connection at a time, on every
  database, with or without Redis. A daily `whoami` checks every key.

## Build and verification

```sh
yarn nx build plugin-integration-ever-works
yarn nx build plugin-integration-ever-works-ui --configuration=production
yarn nx test plugin-integration-ever-works
yarn nx run plugin-integration-ever-works:test-integration
yarn nx test plugin-integration-ever-works-ui
```

The suites run the plugin's migrations on SQLite and its services against the
mock Ever Works server (`src/lib/testing/mock-ever-works.server.ts`, test code
that is not part of the package build). `test-integration` is the boundary
suite (`.scripts/ever-works-integration.test.cjs`, `node:test`): migrations
up/up/down/up on SQLite, and on Postgres when `EVER_WORKS_TEST_DATABASE_URL`
names a loopback `_test` database; tenant and organization isolation; webhook
signatures; dedupe; loop suppression; the 412 merge; an initial sync resumed by
another process; and record scope. The Build workflow runs all three.

Both packages participate in the workspace and Docker builds. The backend is
listed, behind `EVER_WORKS_ENABLED`, in the API and worker plugin lists and
packaged into the API and worker images. The Angular package is registered in
the web application and excluded from backend runtime package copies. The
desktop, server and server-api manifests include the backend package.
