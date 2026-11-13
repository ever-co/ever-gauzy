# Feature Specification: Tasks — saved views, bulk actions, keyboard preferences

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `task-views-and-bulk-actions`
**Branch**: `feat/task-views-and-bulk-actions`
**Status**: `Draft`
**Created**: 2026-11-07
**Last updated**: 2026-11-09
**Owner**: platform maintainers
**Feature flag**: `GAUZY_TASK_VIEWS_ENABLED` (default off)

---

## 1. Overview

Tasks already have statuses, priorities, sizes, labels, versions, issue types, sub-tasks,
related issues, estimates, sprints, daily plans and **saved task views** with advanced
filters. This feature makes those views complete and shared across clients, adds
**bulk actions** and **manual ordering**, built-in **personal views** (my tasks, this
week, overdue, due soon) computed by the platform, **per-user keyboard shortcut
bindings** stored with the user's preferences, and **task references** (`PROJECT-KEY-123`)
that chat and docs can resolve. The same API serves the Angular app, Ever Teams, the
MCP server and the SDKs.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a member with a filtered, grouped list, **when** they save it as "Backend
  bugs" for the team, **then** every team member sees the view with the same filters,
  grouping, ordering, layout and visible properties, and can open it by its id.
- **Given** a personal view, **when** another member lists views, **then** they do not
  see it.
- **Given** 40 selected tasks, **when** a member sets their status to Done in one action,
  **then** each of the 40 changes as one unit (per-task atomicity: a task is changed
  completely or not at all; the request is not all-or-nothing across tasks), the answer
  reports every task's outcome, one activity entry per task is written, followers are
  notified once per task, and an undo restores the previous statuses of the tasks that
  changed.
- **Given** a view ordered manually, **when** a member drags a task between two others,
  **then** the order persists for that view and is the same for everyone who opens it.
- **Given** a member, **when** they open "This week", **then** they see their tasks due
  this week in their own time zone, computed by the platform.
- **Given** a member who rebinds `S` to `T`, **when** they sign in on another device,
  **then** the binding applies there too.
- **Given** a project with key `API`, **when** a message or page contains `API-42`,
  **then** clients can resolve it to the task if the reader may view it.
- **Given** a task moved to another project, **when** an old reference `API-42` is
  used, **then** it still resolves to the task, the answer naming the reference
  the task holds today, and project `API` never gives the number 42 to another
  task. This holds for moves made once former references are recorded
  (migration `1791000006750`): a task moved before keeps no old reference, and
  nothing can rebuild one.

### 2.2 Edge cases & failures

- **Given** a bulk action on tasks across two projects where the member may edit only
  one, **when** applied, **then** the allowed tasks change, the others are reported as
  refused, and nothing is half-applied within one task.
- **Given** more than 100 tasks selected, **when** a bulk action is requested, **then**
  it is refused with the limit named.
- **Given** a project that held the key `API` or whose name derives it, **when**
  another project of the organization asks for `API`, **then** it is refused
  (`PROJECT_KEY_TAKEN`), so a reference never names two projects.
- **Given** a bulk action where one task's update fails part-way, **when** the
  answer reports that task as refused, **then** the task is exactly as it was.
- **Given** a team view edited by two members at once, **when** the second saves on an
  older version, **then** they get a conflict and the latest view.
- **Given** a filter on a deleted label, **when** the view loads, **then** the filter is
  shown as invalid and can be removed.

## 3. Functional Requirements

### Views

- **FR-1** A saved view MUST hold: name, icon, visibility (personal or team/project
  shared), filter tree (and/or groups over status, priority, size, labels, assignees,
  project, team, sprint, due date with relative values, created/updated), grouping,
  ordering (including manual), layout (list, board, table, calendar, timeline), visible
  properties and a version.
- **FR-2** Views MUST be listable per scope (mine, team, project), creatable, updatable
  with a version check; they can be marked as favourites, and deleted by their creator or a manager.
- **FR-3** The platform MUST serve the tasks of a view with cursor pagination and
  server-side grouping counts, resolving relative dates in the caller's time zone.
- **FR-4** Built-in views `mine`, `this-week`, `overdue`, `due-soon` MUST be served
  without saving.
- **FR-5** Manual order within a view MUST be persisted per view and reorderable with a
  single request.

### Bulk actions

- **FR-6** The platform MUST accept one request that applies status, priority, size,
  labels (add/remove), assignees (add/remove), project, sprint, due date or archive to up
  to 100 tasks, applying per-task permission checks, writing per-task activity and
  notifications, and returning per-task results.
- **FR-7** The platform MUST return the previous values so clients can offer undo.

### Keyboard preferences and references

- **FR-8** The platform MUST store per-user keyboard shortcut overrides (command id →
  binding) with the user's UI preferences and return them with the user profile.
- **FR-9** Every project MUST have a unique key within its organization; tasks MUST be
  addressable as `KEY-number`, and old keys MUST keep resolving after a move; the
  platform MUST expose a resolver for references and task links. A task's old
  reference resolves for moves recorded since migration `1791000006750`, not for
  earlier ones.

### Compatibility

- **FR-10** Existing task view, filter and task endpoints MUST keep working unchanged.

## 4. Non-Functional Requirements

- **Performance**: a view page of 50 tasks with counts under 300 ms P95 at 100,000
  tasks per organization; bulk action of 100 tasks under 2 s.
- **Reliability**: bulk actions are per-task atomic; view saves are version-checked.
- **Security & privacy**: team views visible to team members; private views to their
  owner; references resolve only for readers with access.
- **Observability**: activity-log entries for bulk actions and view changes.
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; additive migrations.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `TaskView` (existing) | A saved combination of filters, grouping, ordering, layout and properties; gains visibility, version and manual order |
| `BulkTaskAction` | One request changing a property on many tasks with per-task results |
| `ShortcutBinding` | A user's override of a command's key binding (in UI preferences) |
| `TaskReference` | `KEY-number` identifier of a task, including former keys |

## 6. Out of Scope

- New layouts in the Angular app beyond list/board/table (timeline and calendar may
  follow).
- Automations (auto-close parents, recurring tasks).

## 7. Acceptance Criteria

- [ ] Personal and team views round-trip with all properties; version conflicts handled.
- [ ] Built-in views compute in the caller's time zone.
- [ ] Bulk actions apply atomically per task with per-task results and undo data.
- [ ] Manual order persists per view.
- [ ] Shortcut overrides persist with the user; references resolve, including old keys.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; behind the flag.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- `[NEEDS CLARIFICATION: whether project keys are generated from existing project names on enable (proposed: yes, first 3–5 letters, deduplicated, editable by managers)]`

## 9. Constitution Gates

- [x] I Plugin-first — extends the core tasks module (shared infrastructure), no new plugin.
- [x] II Tenant/organization scoping.
- [x] III Both ORMs, additive migrations.
- [x] IV Default-off flag; nothing removed.
- [x] V Contracts and API first.
- [x] VI Permissions, privacy, security.
- [x] VII Real-time — view and task changes publish change hints.
- [x] VIII i18n and accessibility.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Consumers: Ever Teams `tasks-keyboard-and-views`; [`../chat/spec.md`](../chat/spec.md) (task references)
