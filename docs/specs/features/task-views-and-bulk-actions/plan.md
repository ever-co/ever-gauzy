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
- **Bulk update** (`TaskService.bulkUpdate`) applies tasks one after another through the single update command;
  a task that is missing, another organization's, or refused by its update is reported and the others are
  applied: per-task results (`ok`, `error`, `previous`), never all-or-nothing across tasks. The answer's
  `previous` is a changes object (lists as `set…`), so an undo is the same request with `items` built from it.
  On TypeORM each task's update is one transaction (§7.1): a task reported as
  refused did not change. MikroORM has no transaction there (see §7.1).
- **References** (`TaskService.resolveReferences`) resolve by the project's key, its former keys and the key
  derived from its name; the task's `prefix` stays what the create path writes. Every project answering to the key
  is read: when more than one task of those projects holds the number the answer is `ambiguous: true` and resolves
  to nothing, rather than opening whichever task the store listed first. A key is two to ten upper-case letters or
  digits that no other project of the organization answers to: as its key, as a former key, or as the key derived
  from its name (409 `PROJECT_KEY_TAKEN`, §7.2); clearing it keeps the derived key resolving. When no task of the
  projects answering to a key holds the number, a task that held it before it moved out of one of them answers
  (`formerReference: true`, with `currentKey` and `currentNumber`, §7.3).
- **Built-in views** take the caller's IANA time zone (UTC when none); weeks start on Monday; `overdue` and
  `due-soon` leave out done, completed and cancelled tasks; the caller is the signed-in employee.
- **Keyboard bindings** live under `uiPreferences.keyboard.bindings` (command id → binding); clients own the syntax.
- **Flag**: the new routes answer 404 while `GAUZY_TASK_VIEWS_ENABLED` is not exactly `true`; columns and the
  existing routes are unaffected either way.

## 5. Tests

`task-reference.spec`, `built-in-views.spec`, `bulk-update.spec` (pure); the migration follows the tested style of
`1791000004400`. The in-cluster PR build runs the core suite.
The follow-ups of §7: `task.service.references.database.spec` (update, bulk update and references on real SQLite,
and on real Postgres with `DB_TYPE=postgres GAUZY_TASK_SPEC_POSTGRES_URL=…`), `task-former-reference-migration.spec`
(the migration on real SQLite, and on real Postgres with `GAUZY_MIGRATION_TEST_POSTGRES_URL`), and the project-key
cases of `organization-project.service.task-key.spec`.

## 6. Phase 2

Server-side grouping counts and cursor pagination for a view's tasks (FR-3), a filter tree contract shared with the
clients, invalid-filter reporting (deleted labels), generated keys for existing projects on enable, GraphQL twins,
and the Ever Teams lane `tasks-keyboard-and-views` (shortcut registry, bulk toolbar, saved views pages).

## 7. Follow-ups (done)

What the code merged in ever-gauzy #11688, #11717, #11719 and #11728 did not do, and how the follow-up
(`fix/task-references-atomic-keys-aliases`, migration `1791000006750`) does it. Each item keeps its original
description; **Done:** says what changed.

1. **Per-task atomicity.** `TaskService.update` saves the task first, then writes the sprint move history,
   syncs mentions, moves time logs, reads `syncScope` back and updates the subscriptions, none of it in one
   transaction. When a later step fails, `TaskUpdateCommand` throws after the task already changed, and
   `bulkUpdate` reports that task as `ok: false` although its fields moved (the undo data is still answered).
   Follow-up: run each task's update in one transaction (`typeOrmRepository.manager.transaction`, the
   repositories taken from its manager), or treat the post-save steps as best effort and report the save's
   outcome.
   **Done:** `TaskService.update` runs the save, the former reference of a moved task, the sprint move history
   and the read-back of the sync scope in one TypeORM transaction (`inUpdateTransaction`: a view of the service
   whose repository is the transaction's, so the tenant-aware save and its checks run inside it). Mentions, the
   time-log move (its own transaction, which locks the task row), subscriptions and the activity log are best
   effort and run after the commit. On MikroORM the steps run as before, without a transaction, so a failed
   sprint-history write can still follow a stored save there; the former reference is written before the save,
   so a failed save leaves at most a reference to the number the task still holds (the live number answers
   first), never a moved task without its old reference.
2. **Former and derived keys are not reserved.** The unique check covers current `taskKey`s only: after project
   A renames `API` to `SYS`, project B may take `API`, and a derived key (first three characters of the name) can
   equal another project's key. `resolveReferences` then reads both projects and answers `ambiguous` only when
   both hold the number; when only one does, the reference resolves to that one, which may not be the task the
   author meant. Follow-up: refuse a key that is in another project's `taskKeyHistory` or is another project's
   derived key (409 `PROJECT_KEY_TAKEN`), or prefer the current key and flag every multi-project answer.
   **Done:** a key another project (deleted ones included) holds, held, or derives from its name is refused with
   409 `PROJECT_KEY_TAKEN`, naming the project and how it answers to the key. A project may take back its own
   former key, and a save that sends the project's own key back is not re-checked, so projects keyed before the
   rule keep saving. Still possible: a **rename** can make a project's derived key equal another project's key
   (renames are not refused for that); the resolver then answers `ambiguous` only when both hold the number.
3. **A moved task's old reference.** `TaskService.update` gives a moved task the destination's next number and
   prefix; nothing records the old (`project`, `number`) on the task, so `API-42` no longer reaches it (and may
   later name another task of the old project). Follow-up: keep former references per task (a small
   `task_reference_alias` table or a JSON column), keep the old number from being reissued, and resolve aliases
   after the live numbers.
   **Done:** table `task_former_reference` (`TaskFormerReference`: task, project left, number, prefix; migration
   `1791000006750` on Postgres, MySQL and SQLite). A task leaving a project, for another one or for none, gets a
   row in the update's transaction; `getMaxTaskNumberByProject(…, { withDeleted: true })` (what every writer
   numbers by) counts the rows, so the number is never reissued; `resolveReferences` falls back to them after the
   live numbers. Tasks moved before the migration have no row (nothing to backfill from).
