# @gauzy/plugin-integration-trello

The Trello integration of the Ever Gauzy Platform: an organization connects a Trello member (the application's
key and the member's token), maps Trello boards to platform projects, imports their cards as tasks, keeps the
name, description, completion and due date in sync both ways (lists as statuses), and takes Trello's webhooks
for live updates.

Off by default. The plugin is loaded only when `TRELLO_ENABLED=true` (exactly); off, it adds no route, no table
(its migration is not registered) and makes no outbound request. Same layout as `@gauzy/plugin-integration-asana`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `TRELLO_ENABLED` | `true` loads the plugin. Any other value keeps it off (a value other than `true`/`false` is reported once). |
| `TRELLO_API_KEY` | The application's API key (a Power-Up's key in Trello's admin). |
| `TRELLO_API_SECRET` | The application's secret (shown with the key): Trello signs every webhook delivery with it. Unset, no webhook is registered (imports still work). |
| `TRELLO_APP_NAME` | The name Trello shows on its authorize page. Default: `Ever Gauzy`. |
| `TRELLO_RETURN_URL` | The page Trello sends the person back to with the token. Default: `CLIENT_BASE_URL` + `/#/pages/integrations/trello`. |
| `TRELLO_WEBHOOK_BASE_URL` | The public address Trello delivers webhooks to (default `API_BASE_URL`). |
| `TRELLO_IMPORT_INTERVAL_MINUTES` | How many minutes apart the worker imports the changes of each inbound mapping (default `15`; `0` switches the scheduled import off). A mapping with a live webhook (`webhookId`) is swept every fourth interval instead. |
| `TRELLO_API_URL` | Trello's REST endpoint; only for a test double. |

## How it works

- **Connect.** `POST /integration/trello/install/state` answers a single-use `state` bound to the caller's tenant
  and the organization, and Trello's authorize URL (`expiration=never`, `scope=read,write`, the token returned in
  the URL fragment). Trello sends the person back to the return page with `#token=` and the state; the page
  posts both to `POST /integration/trello/connect`, which consumes the state (it must be the one minted for that
  organization), asks Trello who the token is, and writes an `integration_tenant` named `Trello` with the token and
  the member in its settings. Trello's tokens do not expire; one a person revoked is refused by Trello, and the
  connection then asks for a person. No route answers the token.
- **Map.** `GET …/:integrationId/metadata` lists the member and their open boards; `GET …/boards/:boardId/lists`
  the lists of one. `POST …/mappings` maps a board to a platform project with a `direction` (`inbound` by default,
  `outbound`, `both`) and an optional `listMap` (list id → task status name; an archived or done card is always
  the completed status, a list named like one of the project's statuses becomes that status, anything else is
  open). One mapping per board; a platform project sends its tasks to at most one board.
- **Webhooks.** A mapping registers a webhook on its board at `TRELLO_WEBHOOK_BASE_URL` +
  `/api/integration/trello/webhook/:mappingId` (best effort; `POST …/mappings/:mappingId/webhook` registers it
  again). Trello checks the address with a HEAD request first; every delivery is checked (`x-trello-webhook`, the
  base64 HMAC-SHA1 of the raw body and the callback URL with the application's secret), acknowledged at once, and
  the card its action names is read again from Trello and applied behind the response.
- **Import.** `POST …/mappings/:mappingId/import` (`{ "full": true }` for every card, otherwise the ones changed
  since the last import) runs behind the response, one import per mapping at a time. Each card becomes a task of
  the project once (the platform's id map, entity `TASK`), updated on later runs: name, description, status (the
  list, archived or done), the project's status row of that name, a priority from a label (`urgent`, `high`,
  `Priority: Low`…), due date, members (an employee whose e-mail starts with the Trello username, else whose full
  name matches), labels as tags. A card that could not be applied keeps the import position. A card two mapped
  boards share belongs to the mapping that imported it first. List and status names compare by key: case
  ignored, spaces as hyphens (`In Progress` is `in-progress`). `GET …/runs` lists the runs.
- **Comments and attachments.** Behind every card brought in, its comments (Trello's `commentCard` actions)
  become comments of the task — attributed to the employee the member is (by username, else by name), else kept
  as the connecting user's, marked system and named after their member — and follow an edit in Trello; its
  attachments become resource links of the task (the name, the address that opens it), reusing a link a person
  already added with the same address. Both are kept once (the id map, entities `Comment` and `Attachment`). The
  webhook delivers a comment added, edited or removed and a file attached as the card they belong to, which is
  read again.
- **A refused token.** When Trello refuses the connection's token (a 401), the connection is marked — the page asks for
  a reconnect, the lookups answer `TRELLO_TOKEN_REFUSED`, the scheduled import leaves its mappings alone — and, with the
  Inbox plugin loaded, the person who connected gets a high-priority Inbox notice (one per connection; resolved when a
  renewed token works or someone connects again).
- **Scheduled import.** Every five minutes the worker process (`apps/worker`, the one whose scheduler root is
  enabled) sweeps the mappings that bring cards in: one whose last import is older than
  `TRELLO_IMPORT_INTERVAL_MINUTES` (or that was never imported) is imported again, the changes since its position,
  the longest waiting first and at most fifty per sweep. A mapping with a live webhook (`webhookId`) is swept every fourth interval instead, a reconcile
  against deliveries that were missed. The sweep takes the same claim "import now" takes (one import per mapping
  at a time), opens each tenant's own request context, and leaves a connection whose token was refused to the
  person who must reconnect it. Registered only where a queue root exists; `0` switches it off.
- **Outbound.** When a mapping is `outbound` or `both`, a platform task created or changed updates its card (name,
  description, due date, done by status, and the list the status maps to) or creates one in that list (else the
  board's first). Tasks kept out of third-party sync are never sent; the sync's own inbound writes raise no
  platform event, so nothing echoes.

## Tables

`integration_trello_board_mapping` and `integration_trello_sync_run`, created by the plugin's own migration
(`1791000005100`), idempotent on PostgreSQL, MySQL and SQLite.

## Build

```bash
yarn nx build plugin-integration-trello
yarn nx test plugin-integration-trello
```
