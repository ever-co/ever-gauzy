# @gauzy/plugin-integration-asana

The Asana integration of the Ever Gauzy Platform: an organization connects an Asana account with OAuth,
maps Asana projects to platform projects, imports their tasks, keeps the name, notes, completion and due
date in sync both ways (sections as statuses), and takes Asana's webhooks for live updates.

Off by default. The plugin is loaded only when `ASANA_ENABLED=true` (exactly); off, it adds no route,
no table (its migration is not registered) and makes no outbound request. Same layout as
`@gauzy/plugin-integration-linear`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `ASANA_ENABLED` | `true` loads the plugin. Any other value keeps it off (a value other than `true`/`false` is reported once). |
| `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET` | The OAuth application created in Asana (Developer console → Apps). |
| `ASANA_REDIRECT_URL` | A redirect URL registered on the application. Default: `API_BASE_URL` + `/api/integration/asana/callback`. |
| `ASANA_POST_INSTALL_URL` | Where the callback sends the person once connected. Default: `CLIENT_BASE_URL` + `/#/pages/integrations/asana`. |
| `ASANA_WEBHOOK_BASE_URL` | The public address Asana delivers webhooks to (default `API_BASE_URL`); unset both, and no webhook is registered (imports still work). |
| `ASANA_IMPORT_INTERVAL_MINUTES` | How many minutes apart the worker imports the changes of each inbound mapping (default `15`; `0` switches the scheduled import off). A mapping with a live webhook (`webhookGid`) is reconciled every fourth interval instead (`60` minutes at the default), to pick up deliveries that were missed. The worker sweeps every five minutes, so a due time shorter than five minutes behaves as five; with `0` the sweep still files the refused-token notices the Inbox has not taken. |
| `ASANA_API_URL` | Asana's REST endpoint; only for a test double. |

## How it works

- **Connect.** `POST /integration/asana/install/state` answers a single-use `state` bound to the caller's
  tenant and the organization, and the Asana authorize URL. The public callback consumes the state, exchanges
  the code once, and writes an `integration_tenant` named `Asana` with the tokens and the Asana user in its
  settings. Asana's access tokens last an hour: one about to expire is renewed with the refresh token before
  use (one renewal at a time per connection), and once more when Asana refuses it. No route answers a token.
- **Map.** `GET …/:integrationId/metadata` lists the workspaces; `GET …/workspaces/:workspaceGid/projects`
  the projects of one; `GET …/projects/:projectGid/sections` the sections of one. `POST …/mappings` maps an
  Asana project to a platform project with a `direction` (`inbound` by default, `outbound`, `both`) and an
  optional `sectionMap` (section gid → task status name; a completed task is always the completed status, a
  section named like one of the project's statuses becomes that status, anything else is open). One mapping
  per Asana project; a platform project sends its tasks to at most one Asana project.
- **Webhooks.** A mapping registers a webhook on its Asana project at `ASANA_WEBHOOK_BASE_URL` +
  `/api/integration/asana/webhook/:mappingId` (best effort; `POST …/mappings/:mappingId/webhook` registers it
  again). The target carries a single-use token, and Asana's handshake (`X-Hook-Secret`) is echoed — and the
  secret stored on the mapping — only with that token while the registration is in flight (ten minutes), so an
  unsolicited handshake cannot replace the secret. Every later delivery is checked (`X-Hook-Signature`, the
  HMAC-SHA256 of the raw body), acknowledged at once, and the tasks its events name are read again from Asana
  and applied behind the response.
- **Import.** `POST …/mappings/:mappingId/import` (`{ "full": true }` for every task, otherwise the ones
  changed since the last import) runs behind the response, one import per mapping at a time. Each Asana task
  becomes a task of the project once (the platform's id map, entity `TASK`), updated on later runs: name,
  notes, status (completion and section), the project's status row of that name, a priority from a custom
  field called Priority, due date, the assignee by e-mail, tags as tags, subtasks under their parent (a subtask is in
  the project only when someone added it, so each task's subtasks are read through it, five levels down). The next
  import starts a minute before this one did, whatever the pages carried. A task
  that could not be applied keeps the import position. An Asana task two mapped projects share belongs to the
  mapping that imported it first; the other skips it. Section and status names compare by key: case ignored,
  spaces as hyphens (`In Progress` is `in-progress`). `GET …/runs` lists the runs.
- **Comments and attachments.** Behind every task brought in, its comments (Asana's stories of subtype
  `comment_added`) become comments of the task — attributed to the employee whose user has the author's e-mail,
  else kept as the connecting user's, marked system and named after their author — and follow an edit in Asana;
  its attachments become resource links of the task (the name, the address that opens it), reusing a link a person
  already added with the same address. Both are kept once (the id map, entities `Comment` and `Attachment`), one
  run at a time per task. A comment or attachment that could not be read or kept counts as a failure of the run:
  the import position is kept, so the next import reads the task again; a refusal of one resource (403, 404) is
  not retried. What an earlier run missed for good, `{ "full": true }` brings in.
  The webhook also delivers a comment added or edited and a file attached, as the task they belong to; a mapping
  whose webhook was registered before this filter existed gets it with `POST …/mappings/:mappingId/webhook`.
- **A refused token.** When Asana refuses the connection's token (a 401), the connection is marked — the page asks for
  a reconnect, the lookups answer `ASANA_TOKEN_REFUSED`, the scheduled import leaves its mappings alone — and, with the
  Inbox plugin loaded, the person who connected and the organization's integration managers (members whose role may
  add or edit integrations; when they cannot be read the open notice waits for the sweep, which files it with them) get a high-priority Inbox notice (one per connection; resolved when a
  renewed token works or someone connects again).
- **Conflicts.** Each Asana task applied is compared field by field (title, description — as the task store keeps it, sanitized —, status, priority, due date)
  with what it and its task last agreed on (`integration_asana_task_baseline`, the values Asana sent the last time the Asana task was
  applied): a field changed only in Asana is applied, one changed only on the platform keeps the task's value, and one
  changed on both sides to different values takes Asana's value and is recorded as a conflict with the task's value
  (`integration_asana_sync_conflict`). `GET …/conflicts` lists them (open ones by default; `status`, `mappingId`,
  `taskId`, `runId`, `take`) and `GET …/runs` counts them per run (`conflictCount`). `POST …/conflicts/:conflictId/resolve`
  with `{ "keep": "external" }` leaves Asana's value; `{ "keep": "platform" }` writes the task's value back through
  the platform's task update (a mapping that sends changes out sends it to the Asana task), and is refused (`409`) when the
  task's field changed since. A newer conflict on the same task and field supersedes an older open one. An outbound
  push sends the task's values as they are; a change made in Asana meanwhile is overwritten, not recorded.
- **Scheduled import.** Every five minutes the worker process (`apps/worker`, the one whose scheduler root is
  enabled) sweeps the mappings that bring tasks in: one whose last import is older than
  `ASANA_IMPORT_INTERVAL_MINUTES` (or that was never imported) is imported again, the changes since its position,
  the longest waiting first and at most fifty per sweep. A mapping with a live webhook (`webhookGid`) is reconciled every fourth interval instead (`60` minutes at the default), a reconcile
  against deliveries that were missed. The sweep takes the same claim "import now" takes (one import per mapping
  at a time), opens each tenant's own request context, and leaves a connection whose token was refused to the
  person who must reconnect it. Registered only where a queue root exists; `0` switches it off.
- **Outbound.** When a mapping is `outbound` or `both`, a platform task created or changed updates its Asana
  task (name, notes, completion by status, due date, and the section the status maps to) or creates one in
  the Asana project. Tasks kept out of third-party sync are never sent; the sync's own inbound writes raise no
  platform event, so nothing echoes.

## Tables

`integration_asana_project_mapping` and `integration_asana_sync_run`, created by the plugin's own migration
(`1791000005000`), idempotent on PostgreSQL, MySQL and SQLite. The conflict records, `integration_asana_sync_conflict` and `integration_asana_task_baseline`, come with
migration `1791000007020`.

## Build

```bash
yarn nx build plugin-integration-asana
yarn nx test plugin-integration-asana
```
