# Task Breakdown: Integrations — Linear, Asana, Trello

**Feature ID**: `integrations-asana-linear-trello`
**Plan**: `./plan.md`
**Status**: `Phase 1 merged` (Linear #11692 / #11705, Asana #11694 / #11706, Trello #11698); T15 done; T11 manual checks on dev outstanding
**Last updated**: 2026-11-11

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
- [x] **T13**. Comments inbound (attributed by e-mail, else marked external) and attachments as task file links (resource links; id-map entities `Comment` / `Attachment`; Linear with the issue query, Asana stories + attachments, Trello `commentCard` actions + attachments; ever-gauzy #11700, #11694, #11698)
- [x] **T14**. Scheduled incremental import for every inbound mapping: every interval without a live webhook, every fourth interval (`X_IMPORT_WEBHOOK_STRIDE`) as a reconcile with one (a five-minute sweep in the worker, `X_IMPORT_INTERVAL_MINUTES`; ever-gauzy #11700, #11694, #11698); token refresh when Linear issues expiring tokens (in the Linear plugin's tenant service)
- [x] **T15**. Inbox entry for the integration's managers on a refused token; conflict records and their resolution (ever-gauzy #11774, all three providers: the notice goes to the connector and every member whose role may add or edit integrations; a three-way merge against the last agreed values keeps platform-only changes, records both-side changes as conflicts with `GET …/conflicts` and `POST …/conflicts/:id/resolve`, migrations `1791000007010` / `7020` / `7030`)
  - Conflict UI shipped (ever-gauzy #11789): in the three `integration-<provider>-ui` plugins, each connection's settings list the conflicts (the task and the provider item, the field, both values, when; open or resolved) and resolve them (`keep: external` / `platform`; a 409 keeps the conflict and says why), and the sync log shows each run's `conflictCount` (a count opens that run's conflicts). The Ever Teams Linear / Asana / Trello sections got the same list and resolve action (ever-teams #5055).
- [x] **T16**. Ever Teams `integrations-settings` page on the same routes (ever-teams #4974)

## Asana — (lane G7b)

- [x] **T17**. Plugin on the Linear layout (#11694): OAuth (refresh tokens), workspaces → projects → tasks (sections as statuses, custom priority), subtasks, webhooks with the handshake (single-use token); stories as comments → phase 2 with T13
- [x] **T18**. UI plugin (`integration-asana-ui`, #11694) and Teams page (ever-teams #4975)

## Trello — (lane G7c)

- [x] **T19**. Plugin on the Asana layout (#11698): the authorize page's token handed back by the return page (`POST /connect` with the flow's state), boards → lists → cards (lists as statuses, labels as tags and priority, due dates, members by username or name), webhooks signed with the app secret over the callback URL; checklists as sub-tasks → phase 2
- [x] **T20**. UI plugin (`integration-trello-ui`, #11698) and Teams page (ever-teams #4976)

**Status 2026-11-08:** phase 1 of all three providers merged into `develop` (Linear #11692 / #11705, Asana #11694 / #11706, Trello #11698), with the scheduled import and comments / attachments inbound; open: T11 (manual checks on dev against real workspaces). **2026-11-11:** T15 done (#11774: managers' Inbox notice, conflict records and resolution in all three providers); the conflict UI shipped in the three UI plugins (#11789) and in Ever Teams (ever-teams #5055).
