# Task Breakdown: Task automations

**Feature ID**: `task-automations`
**Plan**: `./plan.md`
**Status**: `Phase 1 and 2 merged; Phase 3 (Ever Teams) in review; T16 (closed links) and T18 (merged pull requests only) done`
**Last updated**: 2026-11-14

---

## Phase 1 — Platform (PR 1)

- [x] **T1**. Spec, plan, tasks (this folder)
- [x] **T2**. Contracts: `task-automation.model.ts` (triggers, conditions, actions, outcomes, rule, run, dry run, templates, events `task_automation.task_changed` / `task_link.closed`), `PermissionsEnum.TASK_AUTOMATION_MANAGE`, default role grants (super admin, admin, manager)
- [x] **T3**. Plugin scaffold `packages/plugins/task-automations` (package, project, tsconfig, jest, eslint), `isTaskAutomationsEnabled`, path mapping, `.env.sample`
- [x] **T4**. Entities + MikroORM repositories; migrations `1791000007810` (tables) and `1791000007820` (role grants), Postgres / MySQL / SQLite, idempotent
- [x] **T5**. Engine (pure): triggers, conditions, action planning, status categories, loop guard, templates, change capture — unit specs for each
- [x] **T6**. Rule service: CRUD, validation of every referenced id against the organization, limits, reorder
- [x] **T7**. Runner + engine services: idempotent run claim, scope, rate limit, conditions on the re-read task, actions through `TaskUpdateCommand` in the system actor's context, notices, history pruning
- [x] **T8**. Capture (CQRS `ActivityLogEvent` → outbox) and consumer (`subscriber:task-automations`); activity attribution subscriber
- [x] **T9**. Due-date schedule: scheduler (worker), queue worker + sweep (API), advisory lock, in-process fallback without a queue
- [x] **T10**. REST controller + DTOs; dry run; run history
- [x] **T11**. GraphQL reads; `graphql-field-binding-check.mjs` entry
- [x] **T12**. Registration: `apps/api/src/plugins.ts` (`TaskAutomationsPlugin`), `apps/worker/src/plugins.ts` (`TaskAutomationsSchedulePlugin`), their specs
- [x] **T13**. Bot threads answered; merged into develop

## Phase 2 — Gauzy app (PR 2)

- [x] **T14**. `@gauzy/plugin-task-automations-ui`: Settings → Automations (list, on/off, create from template or blank, edit trigger / conditions / actions, order, dry run, run history), hidden when the routes answer 404; i18n
  (ever-gauzy #11814: Settings → Automations, 36 specs; `TASK_AUTOMATION_MANAGE` labelled in the 14 locales and placed in
  Roles & Permissions → Projects & tasks)

## Phase 3 — Ever Teams (PR 3, ever-teams)

- [x] **T15**. Settings → Automations behind `NEXT_PUBLIC_TASK_AUTOMATIONS_ENABLED` (default off), hidden on 404; strings in all 13 locales; spec in `docs/specs/features/task-automations/` ([ever-teams#5073](https://github.com/ever-co/ever-teams/pull/5073), `b53891188a`)

## Follow-ups

- [x] **T16**. An integration that reports `task_link.closed` (GitHub pull requests, Linear / Asana / Trello attachments) so the link-closed template fires
  ([ever-gauzy#11908](https://github.com/ever-co/ever-gauzy/pull/11908): GitHub pull requests, merged or not, and
  issues report it — a task link to the item, the task's reference in the pull request's title or branch, the mirrored
  issue — once per task and link (`task_automation_link_closure`); Linear, Asana and Trello attachments carry no state to
  report (spec FR-20), and one that points at GitHub is reported by the GitHub integration)
- [ ] **T17**. Read-only view of the rules for members (open question in the spec)
- [x] **T18**. "Merged pull requests only" on the link-closed trigger (spec FR-21): `mergedOnly` on the trigger
      (validated, stored only when on), the merge claimed beside the close in `task_automation_link_closure` (kind
      `pull_request.merged`, no migration) so a close without merging never blocks a later merge, `closedBefore` on
      `task_link.closed`; the checkbox in the Gauzy rule editor ([ever-gauzy#11944](https://github.com/ever-co/ever-gauzy/pull/11944))
