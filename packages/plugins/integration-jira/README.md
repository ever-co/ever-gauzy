# @gauzy/plugin-integration-jira

The Jira integration of the Ever Gauzy Platform. The package holds two plugins:

- `IntegrationJiraPlugin`: the Jira Connect app descriptor (`atlassian-connect.json`) and its lifecycle and webhook
  routes. Always loaded, unchanged.
- `IntegrationJiraCloudPlugin`: the Jira Cloud sync. An organization connects a Jira Cloud site with OAuth 2.0 (3LO),
  maps Jira projects to platform projects, imports the projects' issues as tasks, keeps the title, description,
  status, priority and due date in sync both ways (a status moves by the transition that reaches it), and takes the
  site's dynamic webhooks for live updates.

The sync is off by default. It is loaded only when `JIRA_ENABLED=true` (exactly); off, it adds no route, no table (its
migration is not registered) and makes no outbound request. `apps/api` lists it right after `IntegrationJiraPlugin`,
whose routes share the `/integration/jira` prefix and must be registered first.

## Configuration

| Variable | Purpose |
| --- | --- |
| `JIRA_ENABLED` | `true` loads the sync. Any other value keeps it off (a value other than `true`/`false` is reported once). |
| `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` | The OAuth 2.0 integration created in the Atlassian developer console, with the Jira API permissions `read:jira-work`, `write:jira-work`, `read:jira-user` and `manage:jira-webhook`. The secret also verifies the webhook deliveries. |
| `JIRA_REDIRECT_URL` | The callback registered on the app. Default: `API_BASE_URL` + `/api/integration/jira/callback`. |
| `JIRA_POST_INSTALL_URL` | Where the callback sends the person once connected. Default: `CLIENT_BASE_URL` + `/#/pages/integrations/jira`. |
| `JIRA_WEBHOOK_URL` | Where Jira delivers the webhooks (HTTPS only; the connection's id is appended). Default: `API_BASE_URL` + `/api/integration/jira/webhook`. Any other address leaves webhooks off, and the scheduled import follows Jira alone. |
| `JIRA_IMPORT_INTERVAL_MINUTES` | How many minutes apart the worker imports the changes of each inbound mapping (default `15`; `0` switches the scheduled import off, and the sweep still renews the webhooks and files the refused-token notices). With webhooks on, every mapping is reconciled every fourth interval instead. The worker sweeps every five minutes, so a due time shorter than five minutes behaves as five. |
| `JIRA_API_URL`, `JIRA_AUTHORIZE_URL`, `JIRA_TOKEN_URL` | Atlassian's API gateway and OAuth endpoints; only for a test double. |

## How it works

- **Connect.** `POST /integration/jira/install/state` (a signed-in admin, `INTEGRATION_ADD` or `INTEGRATION_EDIT`)
  answers a single-use `state` bound to the caller's tenant and the organization, and the Atlassian authorize URL to
  send them to. Atlassian sends them back to the public callback, which binds the connection to the state's tenant
  and organization (never to the query), exchanges the code once, and writes an `integration_tenant` named `Jira`
  with the tokens in its settings. No route answers a token. The access token is renewed before it expires, one
  renewal at a time per connection, and the refresh token rotates on every renewal. A token Jira refuses before its
  expiry is renewed at once (unless another process renewed it meanwhile).
- **Site.** The callback reads the sites the token reaches (`accessible-resources`). With one site the connection uses
  it at once; with several it waits until someone picks one: `GET …/:integrationId/sites`, `PUT …/:integrationId/site`.
  Nothing syncs until a site is chosen. A connection that has mappings, or issues it synced, keeps its site
  (`409` `JIRA_SITE_HAS_MAPPINGS`): a mapping names its Jira project, and an id map its issue, by an id that is unique
  only on its site. It moves to another site by a disconnect and a new connection. A reconnect
  keeps it too; when the new token no longer reaches that site, nothing is saved and the callback answers
  `?error=site_mismatch`.
- **Map.** `GET …/projects` lists the site's projects and `GET …/projects/:projectId` adds a project's issue types and
  statuses. `POST …/mappings` maps a Jira project to a platform project with a `direction` (`inbound`, `outbound`,
  `both`), a status map (the task status for each status category `new`, `indeterminate` and `done`, plus
  `status:<id>` entries for named statuses, which win over their category) and an optional issue-type filter. One
  mapping per Jira project of a connection.
- **Import.** `POST …/mappings/:mappingId/import` (`{ "full": true }` for every issue, otherwise the ones changed
  since the last import) claims the mapping (one run at a time, `409` while one is live; a mapping switched off or
  outbound only answers `409` `JIRA_MAPPING_NOT_INBOUND`) and goes on behind the response. A run that a later claim
  failed as abandoned (no progress for 30 minutes) stops and writes nothing more. It reads Jira's enhanced JQL search page by page, oldest change first, with a relative `updated` window.
  Each issue becomes a task once and is updated by later runs: summary, description (Jira's rich text turned into the
  task store's HTML, escaped, link schemes allow-listed), status by the map, priority by name, the assignee matched by
  e-mail (a hidden e-mail leaves the members alone), labels as tags, due date, parent and sub-tasks, and issue links
  (blocks, clones, duplicates, relates to). Comments come in as task comments (the ones a search leaves out are read
  page by page, up to 1,000 per issue) and attachments as resource links. An issue whose comment or attachment could
  not be kept is read again by the next import. A
  run stopped early (the cap, an API error, an issue that failed) continues from the right place next time. Each run
  writes a report as it goes (pages, issues, comments, links, conflicts, failures by issue key): `GET …/runs`.
- **Webhooks.** One Jira dynamic webhook per connection, for the inbound projects of its mappings, delivered to
  `POST /integration/jira/webhook/:integrationId` (public). A delivery is verified first: `Authorization: Bearer <JWT>`
  signed HS256 with the client secret (the algorithm pinned, `exp`/`nbf`/`iat` checked, a constant-time compare) and
  the connection's webhook among `matchedWebhookIds`. Each delivery (`X-Atlassian-Webhook-Identifier`) is applied once;
  a delivery whose apply failed is released, so Jira's retry goes through. The webhook follows a change of the
  mappings, the site or the delivery address, `POST …/:integrationId/webhook` registers it again on demand, and the scheduled sweep
  refreshes it a week before Jira's 30-day expiry (and registers it again when Jira no longer knows it).
- **Outbound.** When a mapping is `outbound` or `both`, a task change edits the issue's fields and moves its status by
  the transition whose target the task's status maps to (a status named on its own beats one reached by category,
  then a transition without a screen, then Jira's order). When no transition reaches it, the status is left as it is
  and the other fields are still sent. The sync's own inbound writes raise no platform event, so an issue that came in
  is never sent back.
- **Conflicts.** The same three-way merge as the other providers: a field changed on both sides to different values
  takes Jira's value and keeps the task's in a conflict record. Descriptions are compared after a round trip through
  Jira's rich text, so a description sent to Jira and read back is not taken for a change on both sides.
  `GET …/conflicts` lists them; `POST …/conflicts/:conflictId/resolve` with `{ "keep": "external" }` or
  `{ "keep": "platform" }` resolves one (`409` when the task's field changed since).
- **A refused token.** When Atlassian refuses the connection's token, the connection waits for a person to connect
  again: its imports and webhooks pause and, with the Inbox plugin loaded, the person who connected and the
  organization's integration managers get an Inbox notice.
- **Scheduled import.** Every five minutes the worker process (`apps/worker`) sweeps the inbound mappings whose last
  import is older than `JIRA_IMPORT_INTERVAL_MINUTES` (four intervals for a connection whose webhook works: registered,
  unexpired, its last registration not failed). Registered only where a queue root exists.
- **Disconnect.** `DELETE …/:integrationId` removes the connection's webhook from Jira (best effort), then the
  connection and its mappings. The tasks stay.

## Tables

`integration_jira_project_mapping`, `integration_jira_sync_run`, `integration_jira_sync_conflict` and
`integration_jira_issue_baseline`, created by the plugin's own migration (`1791000008400`), idempotent on PostgreSQL,
MySQL and SQLite.

## Build

```bash
yarn nx build plugin-integration-jira
yarn nx test plugin-integration-jira
```
