# Implementation Plan: Integrations — Linear, Asana, Trello

**Feature ID**: `integrations-asana-linear-trello` · **Spec**: [`spec.md`](./spec.md) · **Branches**: `feat/integration-linear`, `feat/integration-asana`, `feat/integration-trello` · **Status**: Linear phase 1 in review (2026-11-07)

## 1. Summary

One API plugin per provider, each a copy of the same shape (the Linear one first, the others on its pattern),
behind a per-provider switch read exactly like the Ever Works one (`LINEAR_ENABLED`, `ASANA_ENABLED`,
`TRELLO_ENABLED`; `true` loads the plugin, anything else keeps it off, a value other than `true` / `false` is
reported once). Off, a plugin adds no route, no table (its migration is not registered) and makes no outbound
request. Each provider gets, in order:

1. **Phase 1 — connect, map, import, two-way status sync, webhooks** (`packages/plugins/integration-<provider>`):
   OAuth connect bound to a single-use state; the provider's teams / workspaces / boards listed; a mapping of each
   to a platform project with a direction and a state map; an import that turns the provider's items into tasks
   once (the platform's id map) and updates them after; signed webhooks applying one item; a task's changes sent
   back to its item through the platform's `TaskEvent`.
2. **Phase 2 — the rest of the spec**: comments and attachments inbound, scheduled polling where the provider has
   no webhooks, an Inbox entry for a refused token, conflict records with a resolution, and the Angular
   `integration-<provider>-ui` plugin (connect page, mappings page, "Import now", runs).
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
cards / lists) and their own webhook scheme (Asana's handshake and `X-Hook-Signature`; Trello's
`X-Trello-Webhook` over the callback URL + body).

## 4. Rules

- **Scope**: a connection is reached only by its id in the caller's tenant; the callback binds the connection to
  the state's tenant and organization, never to its query; a webhook names the provider's workspace, which names
  the connections, never a tenant.
- **Once**: an item becomes a task once, by its id map; later runs update it; an item that moved teams keeps its
  task; archived items are skipped.
- **People**: an assignee is matched by e-mail among the organization's active employees, else the task is left
  unassigned; the sync's writes are attributed to the person who connected.
- **No echo**: inbound writes use `triggeredEvent = false`; outbound sends only what the mapping covers and never a
  task kept out of third-party sync.
- **Attention**: a refused token sets the connection's `attention_reason` and the run fails; nothing is retried
  until a person connects again.

## 5. Open points

- Conflict policy (spec §8): phase 1 lets the provider win for the fields it owns on import and the platform win on
  an outbound push; a conflict record is phase 2.
- Linear's OAuth tokens do not expire today; `expires_at` is stored for when they do. A refresh flow is phase 2.
