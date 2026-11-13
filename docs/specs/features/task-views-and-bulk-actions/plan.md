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
  digits that no other project of the organization answers to: as its key, as a
  former key, or as the key derived from its name (409 `PROJECT_KEY_TAKEN`,
  §7.2); clearing it keeps the derived key resolving. When no task of the
  projects answering to a key holds the number, a task that held it before it
  moved out of one of them answers (`formerReference: true`, with `currentKey`
  and `currentNumber`, §7.3).
- **Built-in views** take the caller's IANA time zone (UTC when none); weeks start on Monday; `overdue` and
  `due-soon` leave out done, completed and cancelled tasks; the caller is the signed-in employee.
- **Keyboard bindings** live under `uiPreferences.keyboard.bindings` (command id → binding); clients own the syntax.
- **Flag**: the new routes answer 404 while `GAUZY_TASK_VIEWS_ENABLED` is not exactly `true`; columns and the
  existing routes are unaffected either way.

## 5. Tests

`task-reference.spec`, `built-in-views.spec`, `bulk-update.spec` (pure); the migration follows the tested style of
`1791000004400`. The in-cluster PR build runs the core suite.
The follow-ups of §7: `task.service.references.database.spec` (update, bulk
update and references on real SQLite, and on real Postgres with
`DB_TYPE=postgres GAUZY_TASK_SPEC_POSTGRES_URL=…`),
`task-former-reference-migration.spec` (the migration on real SQLite, and on
real Postgres with `GAUZY_MIGRATION_TEST_POSTGRES_URL`), and the project-key
cases of `organization-project.service.task-key.spec`.

## 6. Phase 2

Server-side grouping counts and cursor pagination for a view's tasks (FR-3), a filter tree contract shared with the
clients, invalid-filter reporting (deleted labels), generated keys for existing projects on enable, GraphQL twins,
and the Ever Teams lane `tasks-keyboard-and-views` (shortcut registry, bulk toolbar, saved views pages).

## 7. Follow-ups (done)

What the code merged in ever-gauzy #11688, #11717, #11719 and #11728 did not do,
and how the follow-up (`fix/task-references-atomic-keys-aliases`, migration
`1791000006750`) does it. Each item keeps its original description; **Done:**
says what changed.

1. **Per-task atomicity.** `TaskService.update` saves the task first, then writes the sprint move history,
   syncs mentions, moves time logs, reads `syncScope` back and updates the subscriptions, none of it in one
   transaction. When a later step fails, `TaskUpdateCommand` throws after the task already changed, and
   `bulkUpdate` reports that task as `ok: false` although its fields moved (the undo data is still answered).
   Follow-up: run each task's update in one transaction (`typeOrmRepository.manager.transaction`, the
   repositories taken from its manager), or treat the post-save steps as best effort and report the save's
   outcome.
   **Done:** `TaskService.update` runs the save, the former reference of a moved
   task, the sprint move history and the read-back of the sync scope in one
   TypeORM transaction (`inUpdateTransaction`: a view of the service whose
   repository is the transaction's, so the tenant-aware save and its checks run
   inside it). Mentions, the time-log move (its own transaction, which locks the
   task row), subscriptions and the activity log are best effort and run after
   the commit. On MikroORM the steps run as before, without a transaction, so a
   failed sprint-history write can still follow a stored save there; the former
   reference is written before the save, so a failed save leaves at most a
   reference to the number the task still holds (the live number answers first),
   never a moved task without its old reference.
2. **Former and derived keys are not reserved.** The unique check covers current `taskKey`s only: after project
   A renames `API` to `SYS`, project B may take `API`, and a derived key (first three characters of the name) can
   equal another project's key. `resolveReferences` then reads both projects and answers `ambiguous` only when
   both hold the number; when only one does, the reference resolves to that one, which may not be the task the
   author meant. Follow-up: refuse a key that is in another project's `taskKeyHistory` or is another project's
   derived key (409 `PROJECT_KEY_TAKEN`), or prefer the current key and flag every multi-project answer.
   **Done:** a key another project (deleted ones included) holds, held, or
   derives from its name is refused with 409 `PROJECT_KEY_TAKEN`, naming the
   project and how it answers to the key. A project may take back its own former
   key, and a save that sends the project's own key back is not re-checked, so
   projects keyed before the rule keep saving. Still possible: a **rename** can
   make a project's derived key equal another project's key (renames are not
   refused for that); the resolver then answers `ambiguous` only when both hold
   the number.
3. **A moved task's old reference.** `TaskService.update` gives a moved task the destination's next number and
   prefix; nothing records the old (`project`, `number`) on the task, so `API-42` no longer reaches it (and may
   later name another task of the old project). Follow-up: keep former references per task (a small
   `task_reference_alias` table or a JSON column), keep the old number from being reissued, and resolve aliases
   after the live numbers.
   **Done:** table `task_former_reference` (`TaskFormerReference`: task, project
   left, number, prefix; migration `1791000006750` on Postgres, MySQL and
   SQLite). A task leaving a project, for another one or for none, gets a row in
   the update's transaction. `getMaxTaskNumberByProject` with `withDeleted`
   (what every writer numbers by) counts the rows, so the number is never given
   to another task; a task moving back takes it back and its row goes.
   `resolveReferences` falls back to the rows after the live numbers. Tasks
   moved before the migration have no row (nothing to backfill from).

## 8. Angular UI (`@gauzy/plugin-task-views-ui`)

The Angular app had none of the client side; Ever Teams has it (`tasks-keyboard-and-views`). A new lazy UI plugin,
registered in `apps/gauzy/src/plugin-ui.config.ts` like `inbox-ui` and `chat-ui`, brings it to the Angular app. It
shows nothing where the API does not serve the extensions: the UI asks `GET /tasks/built-in/mine` (one task) once per
user and organization; 404 (`GAUZY_TASK_VIEWS_ENABLED` not `true`), 401 and 403 are final, a temporary failure is
retried with a growing delay, then asked again every 5 minutes, at most 6 times. Until it answers there is no nav
entry, no keyboard listener and no reference chip; the route exists and says the views are off.

### 8.1 Reuse

| Need | Existing piece | How it is used |
| --- | --- | --- |
| Plugin shell, routes, nav, translations | `defineDeclarativePlugin`, `NavMenuBuilderService`, `page-sections` / `settings-sections` | `/pages/task-views`, Settings → Keyboard shortcuts, the Tasks nav item, the `TASK_VIEWS` namespace (English, as `inbox-ui` and `chat-ui`) |
| The task's own page | `PAGE_EXTENSION_SLOTS.TASK_VIEW_ACTIONS` (the chat's "Send to chat") | the `KEY-123` chip with copy |
| Preferences | `UsersService.updateUiPreferences`, `Store.user` | `uiPreferences.keyboard.bindings`, shallow-merged per feature key |
| Quick Actions keys (hotkeys-js in the header) | the header's shortcut map | a small `QuickActionShortcutBridge` in `ui-core/core` the header registers with, so a registry sequence that does not complete gives its first key back to the Quick Action it would have run |
| Command ids and binding syntax | Ever Teams `core/lib/keyboard/shortcuts.ts` | the same ids (`goTasks`, `listDown`, …) and syntax (`mod+s`, `g t`), so one rebinding follows the person to both clients |
| Drag and drop | `@angular/cdk/drag-drop` | the manual order |

### 8.2 Modules (`packages/plugins/task-views-ui/src/lib`)

| Module | Responsibility |
| --- | --- |
| `task-views-ui.plugin.ts`, `task-views-ui.constants.ts` | routes, nav item, extension, the keyboard mount, all after the availability check |
| `services/task-views-api.service.ts` | `/task-views` CRUD, `GET /task-views/:id/tasks`, `PUT /task-views/:id/order`, `GET /tasks/built-in/:key`, `POST /tasks/bulk-update`, `POST /tasks/resolve-references`, `DELETE /tasks/:id` |
| `services/task-views-availability.service.ts` | the probe |
| `services/task-views-options.service.ts` | the organization's statuses, priorities, sizes, labels, people, projects, teams and sprints for the editor and the toolbar |
| `models/view-definition.ts` | a view's filter, grouping and ordering read from `filterOptions`, written back merged into what other clients stored there (Ever Teams keeps its own keys beside them); the views grouped as built-in, personal, team, project, organization |
| `models/filter-tree.ts` | the filter-tree editor's model: immutable add / change / remove / nest at a path, the operators a field takes, the API's invalid paths mapped onto the tree, a summary |
| `models/view-conflict.ts` | a 409 `TASK_VIEW_VERSION_CONFLICT` read from the error, the latest view kept; reload or overwrite (the same changes with the latest version) |
| `models/selection.ts` | selection over the page's rows: toggle, Shift range from the anchor, all on the page, the 100 limit |
| `models/bulk-undo.ts` | the bulk request, the per-task outcome summed up, the undo request (`items` from `previous`) |
| `models/manual-order.ts` | a drop as the new full order (rows not loaded keep their place after the loaded ones) |
| `models/task-reference.ts` | a task's reference (`taskKey-number`, else `prefix-number`), what a typed reference is |
| `keyboard/shortcut-registry.ts` | pure: commands, contexts, defaults, parse / format, key caps, overrides, refusals, conflicts, sequence walking |
| `keyboard/shortcut-registry.service.ts` | the one key listener (capture phase; ignored in fields, editors and dialogs), handler registration per context, the overrides from `Store.user`, saving them |
| `keyboard/*-dialog`, `keyboard/*-page` | the `?` help with the bindings in force, Settings → Keyboard shortcuts (record, reset, conflicts) |
| `components/*` | the page (switcher, toolbar, filter editor, grouped list with counts and paging, conflict banner), the bulk toolbar, the save dialog, the go-to-task box, the reference chip |

### 8.3 Rules

- **Views** are listed per organization: the four built-in views, then mine (personal), team, project and
  organization views, by name. Saving writes the filter tree, the grouping and the ordering into `filterOptions`
  beside the keys other clients keep there, and the visible properties into `properties`; it states
  `expectedVersion`. A 409 shows the conflict with **Reload** (take the latest view, drop the edit) and **Overwrite**
  (send the edit again on the latest version). Save as makes a new view; rename, visibility (personal / shared) and
  delete are in the view's menu.
- **The page** reads `GET /task-views/:id/tasks` with the edited tree (an unsaved edit applies at once), the group-by
  and a page of 50; **Load more** follows `nextCursor`. The group counts head the groups; the invalid filters the API
  reports are shown on their conditions, each removable. Built-in views read `/tasks/built-in/:key` (offset pages).
- **Manual order**: a view ordered `manual` takes drag and drop; the drop sends the whole order with the version
  read, and a 409 is the same conflict as a save.
- **Bulk**: the selection holds at most 100 tasks (the platform's limit); one request per action, its per-task
  outcome reported (refused tasks named); an Undo toast for 10 s sends the previous values back as `items`. Delete
  asks first, deletes one task at a time (the platform's own delete, no undo) and reports what failed.
- **Keys** (mounted only where the extensions are served): `?` help; `G` then a letter goes somewhere (`G T` tasks,
  `G V` views, `G M` my tasks, `G W` this week, `G O` overdue, `G I` inbox, `G C` chat, `G D` documents, `G H` home,
  `G P` projects, `G R` go to a task by reference); on the views page `J` / `K` move, `X` selects (`Shift+X` a range),
  `Enter` opens, `Esc` clears, `S` / `P` / `L` / `D` open the toolbar's status, priority, labels and due date for the
  selection, `Mod+S` saves the view. Keys typed into fields, editors and open dialogs are left alone (`?` and `Esc`
  aside). A registry key that is also a Quick Action key wins only where it can run; a `G` not followed by a
  sequence key within 1.2 s runs the Quick Action bound to `G` (the bridge). Overrides are stored as
  `uiPreferences.keyboard.bindings`; ids this client does not know are kept on save.
- **References**: a row and the task's page show `KEY-123` (the project key, else the stored prefix); the go-to box
  resolves what is typed through `POST /tasks/resolve-references` and opens the task, says when it is ambiguous, and
  names the current reference when the task moved.

### 8.4 Tests

Jest specs beside the models (`filter-tree`, `selection`, `bulk-undo`, `view-conflict`, `view-definition`,
`manual-order`, `task-reference`), the registry (`shortcut-registry`, `shortcut-registry.service`) and the plugin's
entry points.
