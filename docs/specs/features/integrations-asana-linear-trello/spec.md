# Feature Specification: Integrations — Asana, Linear, Trello

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `integrations-asana-linear-trello`
**Branch**: `feat/integration-asana`, `feat/integration-linear`, `feat/integration-trello`
**Status**: `Linear phase 1 in review`
**Created**: 2026-11-07
**Last updated**: 2026-11-07
**Owner**: platform maintainers
**Feature flag**: per integration, `LINEAR_ENABLED`, `ASANA_ENABLED`, `TRELLO_ENABLED` (default off; exactly `true` loads the plugin, as `EVER_WORKS_ENABLED`)

---

## 1. Overview

Organizations bring their work from Asana, Linear and Trello into the platform and keep
it in sync. Each integration connects an account, lets a manager map external projects
or boards to platform projects, runs a one-time **import** (tasks, statuses, labels,
assignees by email, comments, attachments, sub-tasks) and optionally keeps a
**continuous sync** in both directions with conflict handling, sync runs and logs. The
three integrations share the platform's integration framework (catalogue, connected
instance per organization, encrypted settings, entity settings, id maps) and the same
settings UI pattern, so Ever Teams and the Angular app configure them the same way.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a manager, **when** they open Integrations and choose Linear → Connect,
  **then** they authorize the platform with Linear and return to a page listing their
  Linear teams.
- **Given** a mapping Linear "Backend" → project "API", **when** the manager runs
  "Import now", **then** issues become tasks with status, priority, labels, assignees
  matched by email, descriptions, comments (attributed to matched employees or marked as
  external), attachments and sub-task relations; the run shows counts and skips.
- **Given** continuous sync on, **when** an issue changes in Linear, **then** the task
  updates within the sync interval (or at once when the provider sends a webhook), and
  the task's activity shows the change as coming from Linear.
- **Given** continuous sync in both directions, **when** a member changes a task's
  status, **then** the Linear issue's state changes accordingly, using the mapping.
- **Given** a Trello board mapped with list → status mapping, **when** a card moves to
  another list, **then** the task's status changes.
- **Given** an Asana project mapped, **when** a task is completed in Asana, **then** the
  platform task gets the mapped completed status.
- **Given** a task created from an import, **when** a member opens it, **then** it shows
  the source badge and a link to the original item.
- **Given** an interrupted import, **when** the manager returns, **then** they can resume
  it; items already imported are not duplicated.

### 2.2 Edge cases & failures

- **Given** an expired or revoked token, **when** a sync runs, **then** the integration
  is marked "needs attention", sync pauses, and the manager gets an Inbox entry.
- **Given** the same item changed on both sides, **when** sync runs, **then** the
  configured side wins (default: the external system for imported fields) and the other
  change is recorded as a conflict visible in the sync log.
- **Given** a webhook with a bad signature, **when** received, **then** it is rejected
  and counted, nothing changes.
- **Given** a provider rate limit, **when** hit, **then** the sync backs off and resumes
  without losing changes.
- **Given** a mapping removed, **when** sync next runs, **then** no further changes flow
  for that project; existing tasks stay.
- **Given** an employee not found by email, **when** importing assignees, **then** the
  task is left unassigned and the external assignee is kept in the task's metadata.

## 3. Functional Requirements

### Common to the three integrations

- **FR-1** Each integration MUST appear in the integration catalogue with its own
  connected instance per organization, encrypted credentials and entity settings for
  PROJECT, TASK, LABEL, COMMENT and USER sync toggles.
- **FR-2** Connect MUST use the provider's OAuth flow where offered (Asana, Linear,
  Trello) with the platform holding the tokens; a personal-token fallback MAY be offered
  where the provider supports it.
- **FR-3** Managers MUST be able to list external workspaces/teams/projects/boards, map
  them to platform projects, map external states/lists to platform statuses and
  priorities, and choose the direction (inbound, outbound, both) per mapping.
- **FR-4** Import MUST be a resumable job with per-item records, counts of created,
  updated and skipped items, and a report; re-running MUST update, never duplicate,
  using the id map.
- **FR-5** Continuous sync MUST run on a schedule and on webhooks (where the provider
  offers them), MUST record sync runs with status, counts and errors, and MUST expose
  conflicts with the ability to resolve them.
- **FR-6** Outbound sync MUST respect the task's sync scope (tasks marked as not for
  third parties are never sent) and MUST only send fields the mapping includes.
- **FR-7** Synced tasks MUST carry the external source and id, a link to the original,
  and MUST show the source in activity entries.
- **FR-8** Comments MUST sync inbound (attributed by email match, else marked external)
  and MAY sync outbound where the provider API allows.
- **FR-9** Attachments MUST be imported as files linked to the task (through the Docs
  file links) when the entity setting is on.
- **FR-10** Errors needing a person (expired token, permission lost) MUST create an
  Inbox entry for the integration's managers.
- **FR-11** Every integration MUST be usable through REST and the SDKs; each MUST be
  enabled independently per deployment.

### Provider notes

- **FR-12 Asana**: workspaces → projects → tasks (sections map to statuses; custom field
  "priority" maps when present; sub-tasks; stories as comments; attachments).
- **FR-13 Linear**: teams → projects/cycles → issues (workflow states by type map to
  statuses; priority 0–4 maps; labels; sub-issues and relations; comments; attachments;
  webhooks for live updates).
- **FR-14 Trello**: boards → lists → cards (lists map to statuses; labels; checklists as
  sub-tasks; due dates; comments; attachments; webhooks).

## 4. Non-Functional Requirements

- **Performance**: import of 10,000 items completes within the provider's rate limits
  without manual intervention; incremental sync runs under one minute for typical deltas.
- **Reliability**: idempotent upserts by external id; resumable jobs; no duplicates.
- **Security & privacy**: tokens encrypted at rest; webhook signatures verified; only
  mapped projects are read; no credentials in logs.
- **Observability**: sync runs, counts, errors and conflicts stored and listed; metrics
  per provider.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; plugin-owned additive
  migrations loaded only where enabled; jobs run in the worker app.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `IntegrationTenant` (existing) | The connected instance of a provider for an organization |
| `IntegrationSetting` / `IntegrationEntitySetting` (existing) | Encrypted credentials and per-entity sync toggles |
| `IntegrationMap` (existing) | External id ↔ platform id |
| `ProjectMapping`  | External project/board ↔ platform project with state/priority mapping and direction |
| `SyncRun`         | One import or sync execution with counts, errors and conflicts |
| `SyncConflict`    | A change that could not be applied automatically |

## 6. Out of Scope

- Time tracking or billing sync.
- Jira (its own stub is separate), GitLab.
- Migration of users (employees must already exist; matching is by email).

## 7. Acceptance Criteria

- [ ] Each provider connects, lists, maps, imports and syncs as specified against a
      test account; re-import updates without duplicates.
- [ ] Both-direction sync applies status changes each way; conflicts are visible and
      resolvable; sync scope is respected.
- [ ] Expired token pauses sync and files an Inbox entry.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; behind per-provider flags.
- [ ] All functional requirements have a passing test (provider APIs mocked in tests).

## 8. Open Questions

- `[NEEDS CLARIFICATION: default conflict policy — external wins for imported fields vs last-writer-wins (proposed: external wins for mapped fields, platform wins for platform-only fields)]` — T15 (2026-11-11) implements the proposal on inbound applies; see plan §4.

## 9. Constitution Gates

- [x] I Plugin-first — one plugin per provider (+ `-ui`), copying the existing two-way sync engine.
- [x] II Tenant/organization scoping.
- [x] III Both ORMs, additive migrations (plugin-owned).
- [x] IV Default-off flags; nothing removed.
- [x] V Contracts and API first.
- [x] VI Permissions, privacy, security — integration permissions, encrypted tokens, signed webhooks.
- [x] VII Real-time — sync results publish change hints.
- [x] VIII i18n and accessibility — settings UI strings in every locale.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Depends on: [`../inbox/spec.md`](../inbox/spec.md) (attention items)
- Consumers: Ever Teams `integrations-settings`
