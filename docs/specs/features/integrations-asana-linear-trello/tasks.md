# Task Breakdown: Integrations — Linear, Asana, Trello

**Feature ID**: `integrations-asana-linear-trello`
**Plan**: `./plan.md`
**Status**: `Linear phase 1 in review`
**Last updated**: 2026-11-07

---

## Linear — Phase 1 (lane G7a, PR 1)

- [x] **T1**. `IntegrationEnum.LINEAR`, the catalogue entry (seed + `ensure()` at boot), the seed icon
- [x] **T2**. Plugin skeleton: `LINEAR_ENABLED` switch (+spec), config reader (+spec), module, plugin, registration (`plugins.ts`, tsconfig path, API dependency, build scripts, `.env.sample`, matrix spec)
- [x] **T3**. OAuth connect: single-use state, `POST /install/state`, public `GET /callback` (code exchanged once, workspace read, connection written), post-install redirect
- [x] **T4**. API client (+spec): viewer, teams, team states and labels, issues by page since a watermark, one issue, update, create; 401 / 429 / GraphQL errors
- [x] **T5**. Entities and migration `1791000004900`: team ↔ project mapping (direction, state map, watermark), sync run (kind, counts, outcome)
- [x] **T6**. Mappings routes (`GET|POST|PUT|DELETE …/mappings`), teams routes, status, metadata, disconnect
- [x] **T7**. Import: `POST …/mappings/:id/import` (full or incremental) in a tenant-scoped context; each issue through `IntegrationMapSyncIssueCommand` (status + row, priority + row, due date, assignee by e-mail, labels as tags, parents linked); runs listed
- [x] **T8**. Webhooks: `POST /webhook` (signature over the raw body, timestamp tolerance, delivery dedupe), one issue applied per connection of the workspace
- [x] **T9**. Outbound: `TaskEvent` → update or create the issue (state by the mapping, title, description, priority, due date); `isTaskSyncAllowed`
- [x] **T10**. README, `.env.sample`, the issue mapper spec, the webhook checks spec
- [ ] **T11**. Bot threads answered (#11692: 4 rounds, 34 threads; #11696: the callback route order, `type: Date` columns, tags, locks); manual check on dev against a Linear workspace (connect, map, import, a webhook, a status change both ways) still to do

## Linear — Phase 2 (lane G7a, PR 2+)

- [x] **T12**. `integration-linear-ui` Angular plugin (#11692): connect page → `install/state` redirect, callback landing, mappings page (team, project, direction, state map), Import now, runs table
- [ ] **T13**. Comments inbound (attributed by e-mail, else marked external) and attachments as task file links
- [x] **T14**. Scheduled incremental import for connections without webhooks (a five-minute sweep in the worker, `X_IMPORT_INTERVAL_MINUTES`; ever-gauzy #11700, #11694, #11698); token refresh when Linear issues expiring tokens (in the Linear plugin's tenant service)
- [ ] **T15**. Inbox entry for the integration's managers on a refused token; conflict records and their resolution
- [x] **T16**. Ever Teams `integrations-settings` page on the same routes (ever-teams #4974)

## Asana — (lane G7b)

- [x] **T17**. Plugin on the Linear layout (#11694): OAuth (refresh tokens), workspaces → projects → tasks (sections as statuses, custom priority), subtasks, webhooks with the handshake (single-use token); stories as comments → phase 2 with T13
- [x] **T18**. UI plugin (`integration-asana-ui`, #11694) and Teams page (ever-teams #4975)

## Trello — (lane G7c)

- [x] **T19**. Plugin on the Asana layout (#11698): the authorize page's token handed back by the return page (`POST /connect` with the flow's state), boards → lists → cards (lists as statuses, labels as tags and priority, due dates, members by username or name), webhooks signed with the app secret over the callback URL; checklists as sub-tasks → phase 2
- [x] **T20**. UI plugin (`integration-trello-ui`, #11698) and Teams page (ever-teams #4976)

**Status 2026-11-07:** Linear phase 1 in ever-gauzy `feat/integration-linear` (PR opened with the lane; bot threads next).
