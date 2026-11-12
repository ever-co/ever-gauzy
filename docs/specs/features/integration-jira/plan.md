<!-- cspell:ignore issuetype -->
# Implementation Plan: Integration — Jira Cloud

**Feature ID**: `integration-jira` · **Spec**: [`spec.md`](./spec.md) · **Branches**: `feat/integration-jira-parity`, `feat/integration-jira-ui`, Ever Teams `feat/integration-jira` · **Status**: platform in review (ever-gauzy #11812) (updated 2026-11-11)

## 1. Summary

The Jira package (`packages/plugins/integration-jira`) had a Connect app descriptor and its stub lifecycle and webhook routes, always loaded as `IntegrationJiraPlugin`. They stay as they were. The sync is a second plugin of the same package, `IntegrationJiraCloudPlugin`, listed by the API right after the first (both use the `/integration/jira` prefix, and the descriptor's fixed routes must be registered before the sync's `/:integrationId`) and only when `JIRA_ENABLED` is exactly `true`. Its shape is Linear's (`../integrations-asana-linear-trello/plan.md` §3), module for module; what differs is Jira's:

- **Connect.** OAuth 2.0 (3LO) at `auth.atlassian.com` with `offline_access`.
  - The site is part of the connection: the callback reads `accessible-resources`. With one Jira site it is chosen at once; with several the connection is stored without one (`siteRequired`) and `PUT /:id/site` chooses it.
  - Every API call goes through the gateway, `api.atlassian.com/ex/jira/<cloudId>/rest/api/3`.
  - Atlassian rotates the refresh token on every renewal. One renewal is in flight per connection, and the row is read again first so a renewal another process made is not spent twice.
- **Mapping.** A Jira project (by id) ↔ a platform project.
  - The status map is JSON with a task status per status category (`new`, `indeterminate`, `done`) and per named status (`status:<id>`). The named status wins over its category, both ways.
  - `issueTypeIds` limits the issue types imported, and its first entry is the type of a task sent out.
- **Import.** The enhanced JQL search (`POST /search/jql`, page tokens).
  - JQL: `project = <id> [AND issuetype in (…)] [AND updated >= "-<n>m"] ORDER BY updated ASC, key ASC`. The window is relative, because an absolute JQL date is read in the token account's time zone.
  - Oldest change first makes a run resumable (`resumeCursorOf`). A complete run moves the position to its start (less a minute). A failed issue's change time is where the next run starts. A run stopped early continues from the last issue it applied.
  - The run's report (JSON on the run) is written with every page.
- **Rich text.** `sync/jira-adf.ts` converts ADF to the task store's HTML (built from the nodes, every text escaped, links limited to http(s)/mailto/tel) and back.
  - The two are inverses on what they produce.
  - The conflict service compares a task's description in its Jira reading (`canonicalHtml`), so a round trip is never a change on both sides.
- **Webhooks.** One dynamic webhook per connection (`POST /rest/api/3/webhook`).
  - It covers `jira:issue_created|updated` and `comment_created|updated`, with `jqlFilter: project in (<inbound mapping project ids>)`.
  - It is delivered to `<JIRA_WEBHOOK_URL or API_BASE_URL/api/integration/jira/webhook>/<connection id>`.
  - It is kept in line with the mappings after every mapping change and by the sweep. It is refreshed (`PUT /webhook/refresh`) within a week of its 30-day expiry, registered again when Jira no longer knows it, and removed on disconnect and on a change of site.
  - A delivery is verified by its `Authorization: Bearer <JWT>`: HS256 with the client secret, the algorithm pinned, `exp`/`nbf`/`iat` checked with a minute's leeway.
  - It must come through a webhook the connection holds (`matchedWebhookIds`).
  - It is claimed by `X-Atlassian-Webhook-Identifier` (Redis `SET NX` across replicas, else in process), and released when its apply failed.
  - The issue is read again from Jira and applied behind the 200.
- **Outbound.** `TaskEvent` leads to `PUT /issue/:id` (summary, ADF description, a priority the site names, the due date), then the transition `chooseTransition` picks.
  - A target named in the map comes before one reached by category; then one without a screen; then Jira's order. When the issue already sits where the task's status maps, nothing moves.
  - A new task of an outbound project creates its issue, once (the id map is written under a per-task lock; a duplicate is deleted).
  - Inbound writes use `triggeredEvent = false`, so nothing comes back out.
- **Links.** Issue links whose two ends are tasks become `TaskLinkedIssue` rows: blocks, clones, duplicates and relates to, recorded from the issue the link points out of.

## 2. Reuse

The platform's integration framework (`IntegrationTenant`, `IntegrationSetting`, `IntegrationEntitySetting`, `IntegrationMap` and its sync commands), the shared synced-fields merge (`mergeSyncedFields`, `syncedValuesOf`, `withoutKeptFields`), the Inbox writer, the scheduler (`@ScheduledJob` + queue worker) and Linear's module layout, copied per provider.

## 3. Modules (`packages/plugins/integration-jira/src/lib`)

| File | Role |
|---|---|
| `jira.controller.ts`, `jira.module.ts`, `integration-jira.plugin.ts` | The Connect descriptor (unchanged) |
| `integration-jira-cloud.plugin.ts`, `jira-cloud.module.ts`, `jira-enabled.ts`, `jira-config.ts`, `jira.constants.ts` | The sync plugin, its switch and configuration |
| `client/jira-api.client.ts` | REST v3 through the gateway, token exchange and refresh, `accessible-resources` |
| `jira-authorization.controller.ts`, `jira-oauth-state.service.ts` | The OAuth callback |
| `jira-tenant.service.ts`, `jira-attention.ts` | The connection, its tokens, site and webhook settings; the Inbox notice |
| `jira-cloud.controller.ts`, `dto/jira.dto.ts` | Management routes |
| `jira-mapping.service.ts`, `entities/*`, `database/migrations/1791000008400-*` | Mappings, runs, conflicts, baselines |
| `sync/jira-sync.service.ts`, `sync/jira-issue.mapper.ts`, `sync/jira-adf.ts`, `sync/jira-issue-details.service.ts` | Import, webhook apply, outbound |
| `sync/jira-webhook.service.ts`, `jira-webhook.controller.ts`, `jira-webhook.verification.ts`, `jira-webhook-dedupe.service.ts` | Webhooks |
| `jira-sync-conflict.service.ts` | Conflicts (the description in its Jira reading) |
| `maintenance/*` | The sweep: notices, webhooks, scheduled imports |

## 4. Rules

- Off by default; the sync's migration is registered only when it is on.
- The Connect routes are registered first (`plugins.ts` order, asserted by `plugins.matrix.spec.ts`), and the sync declares none of their fixed routes (asserted by `jira-cloud.module.spec.ts`).
- No database connection is held across a call to Jira; every apply of an issue holds the issue's lock.
- A webhook delivery is never trusted for content: the issue is read again.

## 5. Open points

- A manual run against a live Jira Cloud site (connect with one and with several sites, a webhook delivery, a transition each way).
- The webhook address must use the app's base URL for Atlassian to register it; deployments behind another host set `JIRA_WEBHOOK_URL`.
