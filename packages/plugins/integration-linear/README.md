# @gauzy/plugin-integration-linear

The Linear integration of the Ever Gauzy Platform: an organization connects its Linear workspace with
OAuth, maps Linear teams to platform projects, imports the teams' issues as tasks, keeps the status,
title, description, priority and due date in sync both ways, and takes Linear's webhooks for live
updates.

Off by default. The plugin is loaded only when `LINEAR_ENABLED=true` (exactly); off, it adds no route,
no table (its migration is not registered) and makes no outbound request.

## Configuration

| Variable | Purpose |
| --- | --- |
| `LINEAR_ENABLED` | `true` loads the plugin. Any other value keeps it off (a value other than `true`/`false` is reported once). |
| `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | The OAuth application created in Linear (Settings → API → OAuth applications). |
| `LINEAR_REDIRECT_URL` | The callback registered on the application. Default: `API_BASE_URL` + `/api/integration/linear/callback`. |
| `LINEAR_POST_INSTALL_URL` | Where the callback sends the person once connected. Default: `CLIENT_BASE_URL` + `/#/pages/integrations/linear`. |
| `LINEAR_WEBHOOK_SECRET` | The application's webhook signing secret. Without it webhooks are refused (imports still work). |
| `LINEAR_IMPORT_INTERVAL_MINUTES` | How many minutes apart the worker imports the changes of each inbound mapping (default `15`; `0` switches the scheduled import off — the sweep still files the refused-token notices the Inbox has not taken). When the application has a webhook secret (`LINEAR_WEBHOOK_SECRET`) every mapping is reconciled every fourth interval instead (`60` minutes at the default), to pick up deliveries that were missed. The worker sweeps every five minutes, so a due time shorter than five minutes behaves as five. |
| `LINEAR_API_URL` | Linear's GraphQL endpoint; only for a test double. |

The webhook URL to register on the application is `API_BASE_URL` + `/api/integration/linear/webhook`,
for the `Issues`, `Comments` and `Attachments` resources — Linear subscribes each resource separately, and
without the last two a comment or an attachment reaches Gauzy only with the scheduled reconciliation.

## How it works

- **Connect.** `POST /integration/linear/install/state` (a signed-in admin, `INTEGRATION_ADD` or
  `INTEGRATION_EDIT`) answers a single-use `state` bound to the caller's tenant and the organization, and
  the Linear authorize URL to send them to. Linear sends them back to the public callback, which binds the
  connection to the state's tenant and organization (never to the query), exchanges the code once, reads the
  workspace, and writes an `integration_tenant` named `Linear` with the tokens and the workspace in its
  settings. No route answers a token. An access token about to expire is renewed with the refresh token
  before use (one renewal at a time per connection, the pair rotated), and once more when Linear refuses it.
- **Map.** `GET /integration/linear/:integrationId/teams` lists the workspace's teams;
  `GET …/teams/:teamId` adds the team's workflow states and labels. `POST …/mappings` maps a team to a
  project with a `direction` (`inbound` by default, `outbound`, `both`) and an optional `stateMap`: the task
  status each kind of Linear state (`triage`, `backlog`, `unstarted`, `started`, `completed`, `canceled`)
  becomes (defaults: open, backlog, open, in-progress, completed, cancelled). One mapping per team.
- **Import.** `POST …/mappings/:mappingId/import` (`{ "full": true }` for every issue, otherwise the ones
  changed since the last import) starts a run behind the response. Each issue becomes a task of the project,
  once (the platform's id map, `integration_map` entity `ISSUE`), updated on later runs: title, description,
  status (and the project's status row of that name), priority, due date, the assignee matched by e-mail (left
  unassigned otherwise), labels as tags (one per label, by the platform's label sync), and sub-issues linked
  to their parent's task. Archived issues are skipped. One import runs per mapping at a time (a second request is
  refused while one is live; a run without progress for 30 minutes counts as abandoned). An issue that could not
  be applied keeps the import position, so the next import reads it again; so does a run stopped at the safety cap
  (50,000 issues, the pages come newest first). A lookup that fails (an employee by e-mail, a label's tag) leaves
  that relation of the task as it is. `GET …/runs` lists the runs with their counts and errors.
- **Webhooks.** `POST /integration/linear/webhook` (public) verifies `Linear-Signature` (the HMAC-SHA256 of
  the raw body with the signing secret), refuses deliveries older than a minute, acknowledges at once (Linear
  gives a receiver five seconds), then applies the issue behind the response through every connection of that
  workspace whose mapping of the team syncs inbound. A delivery (`Linear-Delivery`) is remembered once every
  connection applied it, so a retry does nothing; one that failed is not, and the next import reads the issue
  again (a webhook never moves the import position).
- **Comments and attachments.** They come with every issue read (the latest fifty comments, the first twenty-five
  attachments): each comment becomes a comment of the task — attributed to the employee whose user has the
  author's e-mail, else kept as the connecting user's, marked system and named after their author; a reply goes
  under the comment it answers — and follows an edit in Linear; each attachment becomes a resource link of the task
  (the title, the address that opens it), reusing a link a person already added with the same address. Both are
  kept once (the id map, entities `Comment` and `Attachment`), one run at a time per issue. A comment or attachment
  that could not be kept counts as a failure of the run: the import position is kept, so the next import reads the
  issue again; what an earlier run missed for good, `{ "full": true }` brings in. The webhook also takes a comment or attachment
  created or updated, as the issue it belongs to, which is read again.
- **A refused token.** When Linear refuses the connection's token (a 401), the connection is marked — the page asks for
  a reconnect, the lookups answer `LINEAR_TOKEN_REFUSED`, the scheduled import leaves its mappings alone — and, with the
  Inbox plugin loaded, the person who connected and the organization's integration managers (members whose role may
  add or edit integrations; when they cannot be read the open notice waits for the sweep, which files it with them) get a high-priority Inbox notice (one per connection; resolved when a
  renewed token works or someone connects again).
- **Conflicts.** Each issue applied is compared field by field (title, description — as the task store keeps it, sanitized —, status, priority, due date)
  with what it and its task last agreed on (`integration_linear_issue_baseline`, the values Linear sent the last time the issue was
  applied): a field changed only in Linear is applied, one changed only on the platform keeps the task's value, and one
  changed on both sides to different values takes Linear's value and is recorded as a conflict with the task's value
  (`integration_linear_sync_conflict`). `GET …/conflicts` lists them (open ones by default; `status`, `mappingId`,
  `taskId`, `runId`, `take`) and `GET …/runs` counts them per run (`conflictCount`). `POST …/conflicts/:conflictId/resolve`
  with `{ "keep": "external" }` leaves Linear's value; `{ "keep": "platform" }` writes the task's value back through
  the platform's task update (a mapping that sends changes out sends it to the issue), and is refused (`409`) when the
  task's field changed since. A newer conflict on the same task and field supersedes an older open one. An outbound
  push sends the task's values as they are; a change made in Linear meanwhile is overwritten, not recorded.
- **Scheduled import.** Every five minutes the worker process (`apps/worker`, the one whose scheduler root is
  enabled) sweeps the mappings that bring issues in: one whose last import is older than
  `LINEAR_IMPORT_INTERVAL_MINUTES` (or that was never imported) is imported again, the changes since its position,
  the longest waiting first and at most fifty per sweep. When the application has a webhook secret (`LINEAR_WEBHOOK_SECRET`) every mapping is reconciled every fourth interval instead (`60` minutes at the default), a reconcile
  against deliveries that were missed. The sweep takes the same claim "import now" takes (one import per mapping
  at a time), opens each tenant's own request context, and leaves a connection whose token was refused to the
  person who must reconnect it. Registered only where a queue root exists; `0` switches it off.
- **Outbound.** When a project's mapping is `outbound` or `both` (one such mapping per project), a task created
  or changed on the platform updates its issue (state by the mapping, title, description, priority, due date) or
  creates one in the team; the saved task is read again by id, and the pushes of one task run one after the other.
  Tasks kept out of third-party sync (`syncScope`) are never sent. The sync's own inbound writes raise no platform
  event, so an issue that came in is never sent back.
- **Attention.** A refused token sets the connection's `attention_reason` setting to `token_refused` (shown
  by `GET …/status`); connecting again clears it.

## Tables

`integration_linear_team_mapping` and `integration_linear_sync_run`, created by the plugin's own migration
(`1791000004900`), idempotent on PostgreSQL, MySQL and SQLite. The conflict records, `integration_linear_sync_conflict` and `integration_linear_issue_baseline`, come with
migration `1791000007010`.

## Build

```bash
yarn nx build plugin-integration-linear
yarn nx test plugin-integration-linear
```
