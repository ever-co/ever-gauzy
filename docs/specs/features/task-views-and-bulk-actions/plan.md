# Implementation Plan: Tasks — saved views, bulk actions, keyboard preferences

**Feature ID**: `task-views-and-bulk-actions` · **Spec**: [`spec.md`](./spec.md) · **Branch**: `feat/task-views-and-bulk-actions` · **Status**: Phase 1 in review, ever-gauzy #11688 (2026-11-07)

## 1. Summary

Extends the core tasks module (no new plugin) behind `GAUZY_TASK_VIEWS_ENABLED` (default off): saved views gain a
visibility (personal / shared), a save version with conflict detection and a manual order; one request changes up
to 100 tasks and answers per-task results with the previous values (undo); the platform computes the built-in views
(`mine`, `this-week`, `overdue`, `due-soon`) in the caller's time zone; projects get a key (`API`) with a history,
and `KEY-number` references resolve to tasks; per-user keyboard bindings ride on the existing UI preferences. The
existing task and view routes keep working unchanged.

## 2. Reuse

| Need | Existing piece | How it is used |
| --- | --- | --- |
| Saved views | `TaskView` entity, `/task-views` CRUD, favourites (`BaseEntityEnum.TaskView`), activity log | three columns added; version and visibility checks in the service |
| Per-task writes | `TaskUpdateCommand` (activity, notifications, sync events, time-log moves) | the bulk route runs it once per task |
| Task numbering | `Task.prefix` / `Task.number`, `GET /tasks/by-number/:prefix/:number` | the derived key (first three characters of the project name) keeps resolving beside the project key |
| Preferences | `User.uiPreferences`, `PUT /user/ui-preferences` (shallow merge per feature key) | a typed `keyboard.bindings` feature key, no new route |
| Flags | the `isChatEnabled` contract (`true` exactly) | `isTaskViewsEnabled` + `TaskViewsEnabledGuard` (404 when off) |
| Migrations | the additive-column migration style (`1791000004400`) | `1791000004700-AddTaskViewsAndProjectKeys` |

## 3. Modules (`packages/core/src/lib`)

| Module | Responsibility |
| --- | --- |
| `contracts`: `task-view.model.ts`, `task.model.ts`, `organization-projects.model.ts`, `user.model.ts` | `TaskViewVisibilityEnum`, `visibility` / `version` / `manualOrder`, `expectedVersion`, order input; bulk changes / items / outcome; references; `TaskBuiltInViewEnum`; project `taskKey` / `taskKeyHistory`; `IKeyboardUiPreferences` |
| `tasks/views/view.entity.ts`, `view.service.ts`, `view.controller.ts`, `dto/` | the columns; `findAll` / `findOneByIdString` hide others' personal views; `update` checks `expectedVersion` (409 `TASK_VIEW_VERSION_CONFLICT` with the latest view) and bumps the version; `PUT /task-views/:id/order` |
| `tasks/bulk-update.ts` (+spec) | request normalization (`taskIds` + `changes` or `items`, limit 100, each task once), changes → update input with the previous values in the same shape |
| `tasks/task-reference.ts` (+spec) | key validation and normalization, derived key and prefix, reference parsing, the keys a project answers to, a free key for a new project |
| `tasks/built-in-views.ts` (+spec) | day and week bounds in an IANA time zone, the window of each built-in view |
| `tasks/task-views-enabled.ts` | the flag and the guard |
| `tasks/task.service.ts`, `task.controller.ts`, `dto/task-views-extensions.dto.ts` | `POST /tasks/bulk-update`, `POST /tasks/resolve-references`, `GET /tasks/built-in/:key` |
| `organization-project/*.entity.ts`, `dto/organization-project.dto.ts`, `*.service.ts` | `taskKey` (validated, indexed) and `taskKeyHistory`; uniqueness within the organization (409 `PROJECT_KEY_TAKEN`), the replaced key kept in the history |
| `database/migrations/1791000004700-AddTaskViewsAndProjectKeys.ts` | the five columns and the `(organizationId, taskKey)` index, tri-dialect, idempotent |

## 4. Rules

- **Personal views** are listed to their creator only and read as not found to anyone else; a view without a
  visibility is shared (every view saved before the column).
- **Version**: every save bumps it; an update or an order that states `expectedVersion` is refused with 409 and the
  latest view when the view moved on. A save without one behaves as before.
- **Bulk update** applies tasks one after another through the single update command; a task that is missing,
  another organization's, or refused by its update is reported and the others are applied. The answer's `previous`
  is a changes object (lists as `set…`), so an undo is the same request with `items` built from it.
- **References** resolve by the project's key, its former keys and the key derived from its name; the task's
  `prefix` stays what the create path writes. A key is two to ten upper-case letters or digits, unique within the
  organization; clearing it keeps the derived key resolving.
- **Built-in views** take the caller's IANA time zone (UTC when none); weeks start on Monday; `overdue` and
  `due-soon` leave out done, completed and cancelled tasks; the caller is the signed-in employee.
- **Keyboard bindings** live under `uiPreferences.keyboard.bindings` (command id → binding); clients own the syntax.
- **Flag**: the new routes answer 404 while `GAUZY_TASK_VIEWS_ENABLED` is not exactly `true`; columns and the
  existing routes are unaffected either way.

## 5. Tests

`task-reference.spec`, `built-in-views.spec`, `bulk-update.spec` (pure); the migration follows the tested style of
`1791000004400`. The in-cluster PR build runs the core suite.

## 6. Phase 2

Server-side grouping counts and cursor pagination for a view's tasks (FR-3), a filter tree contract shared with the
clients, invalid-filter reporting (deleted labels), generated keys for existing projects on enable, GraphQL twins,
and the Ever Teams lane `tasks-keyboard-and-views` (shortcut registry, bulk toolbar, saved views pages).
