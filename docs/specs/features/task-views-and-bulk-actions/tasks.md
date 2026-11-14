# Task Breakdown: Tasks — saved views, bulk actions, keyboard preferences

**Feature ID**: `task-views-and-bulk-actions`
**Plan**: `./plan.md`
**Status**: `In review`
**Last updated**: 2026-11-13

---

## Phase 1 — Platform (lane G6, PR 1)

- [x] **T1**. Contracts: view visibility / version / manual order and `expectedVersion`; bulk changes, items, outcome; references; built-in view keys; project `taskKey` / `taskKeyHistory`; `keyboard` UI preference
- [x] **T2**. `TaskView` columns, personal views hidden from others, version check on update, `PUT /task-views/:id/order`
- [x] **T3**. `POST /tasks/bulk-update` (≤ 100 tasks, per-task results with previous values, the single update command per task)
- [x] **T4**. Project keys: entity and DTO fields, uniqueness within the organization, history on rename; `POST /tasks/resolve-references` (key, former keys, derived key)
- [x] **T5**. `GET /tasks/built-in/:key` in the caller's time zone
- [x] **T6**. `GAUZY_TASK_VIEWS_ENABLED` flag and guard; `.env.sample`
- [x] **T7**. Migration `1791000004700` (five columns, one index; Postgres, SQLite, MySQL; idempotent)
- [x] **T8**. Specs: references, built-in windows, bulk normalization and undo data
- [ ] **T9**. In-cluster PR build green; bot threads answered; manual check on dev (personal view hidden, 409 on a stale save, bulk update + undo, `API-42` resolves)

## Phase 2

- [x] **T10**. Server-side grouping counts and cursor pagination for a view's tasks; filter tree contract; invalid filters reported
- [x] **T11**. Generated keys for existing projects on enable (owner's call; proposed: first letters, deduplicated, editable)
  (ever-gauzy #11728: migration `1791000004950-BackfillProjectTaskKeys`
  keys every project without one, oldest first, from the first letters of
  its name, unique within the organization against held, former and derived
  keys; a new project gets one on create; keys stay editable). Exceptions: a
  project whose name proposes no key (its first characters are not a key and it
  has fewer than two letters: `3D`, `1A`, `9`) and a
  project with a blank or malformed stored key are left as they are, for a
  manager; a project created with `taskKey: null`, or when the key lookup
  cannot run (no organization scope, a failed read), is created without one
- [x] **T12**. GraphQL twins of the new routes
- [x] **T13**. Ever Teams lane `tasks-keyboard-and-views` (shortcut registry over `uiPreferences.keyboard`, bulk toolbar, saved views pages, palette groups) ([ever-teams#4970](https://github.com/ever-co/ever-teams/pull/4970), [ever-teams#5057](https://github.com/ever-co/ever-teams/pull/5057), [ever-teams#5058](https://github.com/ever-co/ever-teams/pull/5058), [ever-teams#5108](https://github.com/ever-co/ever-teams/pull/5108))

**Status 2026-11-07:** phase 1 in ever-gauzy [#11688](https://github.com/ever-co/ever-gauzy/pull/11688) (ready for review; in-cluster build + bot threads next).

## Follow-ups (from the plan's §7)

- [x] **T14**. One transaction per task in the bulk update (or best-effort
  post-save steps) so a result is accurate (plan §7.1)
- [x] **T15**. Reserve former and derived project keys within the organization
  (plan §7.2)
- [x] **T16**. Keep a moved task's former references and resolve them (plan
  §7.3)

## Phase 3 — Angular UI (`@gauzy/plugin-task-views-ui`, plan §8)

- [x] **T17**. Plugin scaffold: availability probe, `/pages/task-views`, the
  Tasks nav item, `TASK_VIEWS` translations, the app's registration and build
  lists
- [x] **T18**. Saved views: switcher (built-in, personal, team, project,
  organization), save / save as / rename / delete / visibility, 409 conflict
  with Reload and Overwrite
- [x] **T19**. Filter-tree editor (the API's fields and operators, and / or
  groups, relative dates), group-by with the counts, cursor paging, invalid
  filters shown on their conditions
- [x] **T20**. Manual order: drag and drop, `PUT /task-views/:id/order` with the
  version
- [x] **T21**. Bulk: checkboxes, Shift-click range, all on the page (100 at
  most), the toolbar (status, priority, size, assignees, labels, project, due
  date, archive, delete), the Undo toast (10 s)
- [x] **T22**. Keyboard: the registry service over `uiPreferences.keyboard`,
  list keys, `G` sequences, the `?` help, Settings → Keyboard shortcuts; the
  Quick Actions bridge
- [x] **T23**. Project keys: `KEY-123` on rows and on the task's page, the
  go-to-task box
- [x] **T24**. Specs: registry, selection, undo, filter-tree model, conflict
  handling
- [ ] **T25**. Manual check on dev with `GAUZY_TASK_VIEWS_ENABLED=true` (views
  round trip, 409 on a stale save, a drop, bulk + undo, `G T`, `?`, a rebinding
  seen in Ever Teams, `API-42` in the go-to box)

- [x] **T26**. Timeline layout of a saved view (Layout: List, Timeline, saved
  as `displayOptions.layout = 'timeline'` like Ever Teams; a Teams board shows
  as the list and stays a board): bars from start to due date by weeks or
  months, today marked, overdue and single-date bars, tasks past the capped
  calendar marked at its edge, the undated ones apart; grouping and row
  properties hidden, manual order dragged in the list only. Same day rules as
  the Ever Teams timeline (`models/timeline.ts`). Read only: dragging dates is
  a later step
- [ ] **T27**. Manual check of the timeline on dev (a view switched to
  Timeline and back, the same view opened in Ever Teams)

**Status 2026-11-11 (phase 3):** ever-gauzy
[#11805](https://github.com/ever-co/ever-gauzy/pull/11805)
(`feat/task-views-angular`): T17-T24 written with unit specs; T25 not done.
