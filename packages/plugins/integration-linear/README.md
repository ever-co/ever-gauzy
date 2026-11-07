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
| `LINEAR_API_URL` | Linear's GraphQL endpoint; only for a test double. |

The webhook URL to register on the application is `API_BASE_URL` + `/api/integration/linear/webhook`,
for the `Issues` resource.

## How it works

- **Connect.** `POST /integration/linear/install/state` (a signed-in admin, `INTEGRATION_ADD` or
  `INTEGRATION_EDIT`) answers a single-use `state` bound to the caller's tenant and the organization, and
  the Linear authorize URL to send them to. Linear sends them back to the public callback, which binds the
  connection to the state's tenant and organization (never to the query), exchanges the code once, reads the
  workspace, and writes an `integration_tenant` named `Linear` with the token and the workspace in its
  settings. The token is never answered by a route.
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
  be applied keeps the import position, so the next import reads it again. `GET …/runs` lists the runs with
  their counts and errors.
- **Webhooks.** `POST /integration/linear/webhook` (public) verifies `Linear-Signature` (the HMAC-SHA256 of
  the raw body with the signing secret), refuses deliveries older than a minute, then applies the issue through
  every connection of that workspace whose mapping of the team syncs inbound. A delivery (`Linear-Delivery`) is
  remembered once applied, so a retry does nothing; one that failed answers 500, which Linear retries.
- **Outbound.** When a project's mapping is `outbound` or `both` (one such mapping per project), a task created
  or changed on the platform updates its issue (state by the mapping, title, description, priority, due date) or
  creates one in the team; the saved task is read again by id, and the pushes of one task run one after the other.
  Tasks kept out of third-party sync (`syncScope`) are never sent. The sync's own inbound writes raise no platform
  event, so an issue that came in is never sent back.
- **Attention.** A refused token sets the connection's `attention_reason` setting to `token_refused` (shown
  by `GET …/status`); connecting again clears it.

## Tables

`integration_linear_team_mapping` and `integration_linear_sync_run`, created by the plugin's own migration
(`1791000004900`), idempotent on PostgreSQL, MySQL and SQLite.

## Build

```bash
yarn nx build plugin-integration-linear
yarn nx test plugin-integration-linear
```
