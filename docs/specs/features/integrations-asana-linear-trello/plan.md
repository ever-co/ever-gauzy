# Implementation Plan: Integrations — Linear, Asana, Trello

**Feature ID**: `integrations-asana-linear-trello` · **Spec**: [`spec.md`](./spec.md) · **Branches**: `feat/integration-linear`, `feat/integration-asana`, `feat/integration-trello` · **Status**: phase 1 code merged into `develop` for Linear (ever-gauzy #11692, #11705), Asana (#11694, #11706) and Trello (#11698); the manual checks on dev (tasks T11) are outstanding (updated 2026-11-08)

## 1. Summary

One API plugin per provider, each a copy of the same shape (the Linear one first, the others on its pattern),
behind a per-provider switch read exactly like the Ever Works one (`LINEAR_ENABLED`, `ASANA_ENABLED`,
`TRELLO_ENABLED`; `true` loads the plugin, anything else keeps it off, a value other than `true` / `false` is
reported once). Off, a plugin adds no route, no table (its migration is not registered) and makes no outbound
request. Each provider gets, in order:

1. **Phase 1 — connect, map, import, two-way status sync, webhooks** (`packages/plugins/integration-<provider>`):
   OAuth connect bound to a single-use state; the provider's teams / workspaces / boards listed; a mapping of each
   to a platform project with a direction and a state map; an import that turns the provider's items into tasks
   once (the platform's id map) and updates them after; signed webhooks (each delivery verified, acknowledged at
   once, and every item its events name re-read from the provider and applied behind the response: all the
   tasks of an Asana delivery's `events` array, the card of Trello's one action, Linear's one entity; an empty
   Asana heartbeat is verified and answered 200 with nothing to apply); a task's changes sent back to its item
   through the platform's `TaskEvent`; a scheduled import sweep (`maintenance/<provider>-import-sweep.service.ts`)
   that imports every inbound mapping incrementally every `<PROVIDER>_IMPORT_INTERVAL_MINUTES` (default 15) when
   it has no live webhook, and every fourth interval (`<PROVIDER>_IMPORT_WEBHOOK_STRIDE`) when it has one
   (Linear: when `LINEAR_WEBHOOK_SECRET` is set), the reconcile against deliveries the provider gave up on
   (Trello stops after three attempts).
2. **Phase 2 — the rest of the spec**: comments and attachments inbound, an Inbox entry for a refused token,
   conflict records with a resolution, and the Angular `integration-<provider>-ui` plugin (connect page, mappings
   page, "Import now", runs).
3. **Ever Teams** consumes the same routes from its `integrations-settings` page.

## 2. Reuse

| Need | Existing piece | How it is used |
| --- | --- | --- |
| The connected instance, its credentials, its id maps | `IntegrationTenant`, `IntegrationSetting`, `IntegrationEntitySetting`, `IntegrationMap` and their commands (`IntegrationTenantUpdateOrCreateCommand`, `IntegrationSettingGetManyCommand`, `IntegrationMapSyncIssueCommand`, `IntegrationMapSyncLabelCommand`, `IntegrationMapSyncEntityCommand`) | one `integration_tenant` per connected organization, the token in its settings (never answered by a route), one map row per item and per label |
| The catalogue card | `DEFAULT_INTEGRATIONS` (seed) and the Ever Works `ensure()` upsert at boot | both: a fresh database seeds it, an existing one gets it when the plugin first runs |
| The OAuth state | the GitHub plugin's single-use nonce bound to the tenant and organization that started the flow | the same, in the platform's cache |
| Writing tasks outside a request | the Ever Works `runWithRequest` sync user | imports and webhooks open a tenant-scoped context signed in as the person who connected |
| Outbound | the GitHub `TaskEvent` subscriber and `isTaskSyncAllowed(task, 'third-party')` | a task of a project mapped outbound updates or creates its item; the sync's own inbound writes raise no event |
| Signed webhooks | the Ever Works raw-body receiver (`request.rawBody`, `timingSafeEqual`) | the provider's signature header verified over the raw bytes; timestamp tolerance; delivery ids deduplicated |
| Migrations | the Ever Works tri-dialect helpers (`IF NOT EXISTS`, probes, an advisory lock) | copied per plugin; plugin-owned tables only |
| Plugin loading | `apps/api/src/plugins.ts` switch pattern and the plugin matrix spec | one flag-gated entry and one matrix row per provider |

## 3. Modules (`packages/plugins/integration-linear/src/lib`, the template)

| Module | Responsibility |
| --- | --- |
| `linear-enabled.ts`, `linear-config.ts` (+specs) | the switch; `LINEAR_CLIENT_ID` / `_SECRET`, the callback and post-install URLs (derived from `API_BASE_URL` / `CLIENT_BASE_URL` unless set), the webhook secret |
| `linear-catalog.service.ts`, `linear.lifecycle.ts` | the catalogue row at boot; the "configured" log line |
| `linear-oauth-state.service.ts` | the single-use connect state |
| `client/linear-api.client.ts` (+spec) | the GraphQL slice: viewer and workspace, teams, a team's states and labels, issues by page (since a watermark), one issue, issue update and creation; the code exchange; refused token / rate limit / GraphQL errors as one error type |
| `entities/linear-team-mapping.entity.ts`, `entities/linear-sync-run.entity.ts`, `database/` | a team ↔ project mapping (direction, state map, watermark); a run (kind, counts, outcome); migration `1791000004900` |
| `linear-tenant.service.ts` | the connection of an organization, by id, by workspace; the token → client; connect; attention; disconnect |
| `linear-mapping.service.ts`, `linear-sync-run.service.ts` | the mappings (project in the organization, one per team) and the runs |
| `sync/linear-issue.mapper.ts` (+spec) | pure: state kinds ↔ task statuses (defaults and the mapping's map), priorities both ways, due dates, the issue's task fields, the issue update of a task, the watermark |
| `sync/linear-sync.service.ts` | the import (pages, parents linked at the end, rate limit waited once, counts), one issue from a webhook, the outbound push |
| `sync/linear-event.subscriber.ts` | `TaskEvent` → push |
| `linear.controller.ts`, `linear-authorization.controller.ts`, `linear-webhook.controller.ts` (+spec), `dto/` | the management routes (guards + `INTEGRATION_*` permissions), the public callback, the public webhook |

Asana and Trello repeat the layout with their own client (REST), their own item shape (tasks / sections,
cards / lists) and their own webhook scheme, one webhook per mapping at
`/integration/<provider>/webhook/:mappingId`:

- **Asana** (`asana-webhook.controller.ts`): the handshake's `X-Hook-Secret` is stored on the mapping and echoed,
  accepted only while a registration this platform started is in flight (its single-use `?handshake=` token,
  `ASANA_WEBHOOK_HANDSHAKE_WINDOW_MS`); every later delivery is verified with that mapping's secret
  (`X-Hook-Signature` = hex HMAC-SHA256 of the raw body, `isAsanaSignatureValid`); `taskGidsOf` reads every event
  of the `events` array (a task's own events, and the parent task of a story or an attachment), each task once;
  an empty `events` array (the heartbeat) is answered 200 with nothing queued.
- **Trello** (`trello-webhook.controller.ts`): `HEAD` answers 200 for a known mapping (Trello's registration
  check); `X-Trello-Webhook` is the base64 HMAC-SHA1, with the application secret, of the **raw body followed by
  the exact registered callback URL** (`isTrelloSignatureValid`); one action per delivery.

## 4. Rules

- **Scope**: a connection is reached only by its id in the caller's tenant; the callback binds the connection to
  the state's tenant and organization, never to its query. Webhooks never take a tenant from the payload:
  Linear's one application webhook names the workspace (`organizationId`), which names the connections, each
  applying through its own inbound mapping; an Asana or Trello webhook is registered per mapping, and the
  mapping in its path names the connection, the tenant and (Asana) the secret it is verified with.
- **Once**: an item becomes a task once, by its id map; later runs update it; an item that moved teams keeps its
  task; archived items are skipped.
- **People**: an assignee is matched by e-mail among the organization's active employees, else the task is left
  unassigned; the sync's writes are attributed to the person who connected.
- **No echo**: inbound writes use `triggeredEvent = false`; outbound sends only what the mapping covers and never a
  task kept out of third-party sync.
- **Attention**: a refused token sets the connection's `attention_reason` and the run fails; nothing is retried
  until a person connects again. The Inbox notice (one per connection, resolved when the token works again) goes to
  the person who connected and to the organization's integration managers: active members whose role grants
  `INTEGRATION_ADD` or `INTEGRATION_EDIT` (`IntegrationTenantService.findManagerUserIds`, core). When the managers
  cannot be read, an open notice is not filed: its timestamp is marked `deferred`, and the sweep files it with them and
  re-surfaces it (a retry of a filing the Inbox took does not re-surface); a new refusal clears the previous refusal's
  filing timestamp first, so every early return is retried. The lookup reads at most 100 memberships plus one, to know
  whether more exist: a read of exactly 100 is complete and replaces the recipients; a cut read is filed (and recorded)
  without removing anyone, and logged.
- **Conflicts** (T15): an inbound apply merges the synced fields (title, description, status, priority, due date)
  three ways with the values the provider sent the last time the item was applied (`integration_<provider>_*_baseline`,
  one row per item): changed only by the provider → applied; only on the platform → the task keeps it; on both sides
  to different values → the provider's value is applied and the task's recorded in `integration_<provider>_sync_conflict`
  (with the task's own columns to restore). The conflicts are written before the task (taken back if its write
  fails), the baseline after it; descriptions are compared as the task store keeps them (`sanitizeRichHtml`). `GET …/conflicts` lists them, `GET …/runs` counts them per run,
  `POST …/conflicts/:id/resolve` keeps the provider's value or writes the task's back through `TaskUpdateCommand` (its
  event sends it out on an outbound mapping; refused when the task's field changed since). The merge itself is core's
  `mergeSyncedFields` (`integration-tenant/integration-sync-fields.ts`), shared by the three plugins. An item with no
  baseline yet (applied before T15) is applied as before and gets one. Outbound pushes are not checked against the
  provider (that would cost a read per push): the platform's values win there.

## 5. Open points

- Conflict policy (spec §8): T15 implements the proposal — on an inbound apply the provider wins a field changed on
  both sides (the task's value is recorded and can be restored), a field changed only on the platform is kept; an
  outbound push still sends the platform's values. A per-mapping choice of the winning side is not offered yet.
- Linear's OAuth tokens do not expire today; `expires_at` is stored for when they do. A refresh flow is phase 2.
