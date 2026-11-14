# Implementation Plan: Task automations

**Feature ID**: `task-automations` · **Spec**: [`spec.md`](./spec.md) · **Branch**: `feat/task-automations` · **Status**: Phase 1 (platform) in progress (2026-11-11)

## 1. Summary

A new plugin, `@gauzy/plugin-task-automations` (`packages/plugins/task-automations`), loaded only when
`GAUZY_TASK_AUTOMATIONS_ENABLED` is exactly `true`. It owns two tables (`task_automation_rule`,
`task_automation_run`), the `/api/task-automations` routes and GraphQL reads, a capture of the platform's task
change facts onto the event outbox, an outbox consumer that evaluates the rules, and a 15-minute schedule for the
due-date trigger. Changes are written through the platform's own `TaskUpdateCommand`, inside a request context of a
system actor of the rule's organization, so the activity log, notifications, subscriptions, integrations and real-time
hints behave exactly as for a person's change. The Gauzy app gets a lazy `@gauzy/plugin-task-automations-ui`
(Settings → Automations); Ever Teams gets the same page behind `NEXT_PUBLIC_TASK_AUTOMATIONS_ENABLED`.

## 2. Reuse

| Need | Existing piece | How it is used |
| --- | --- | --- |
| "A task changed", with before / after | `ActivityLogService.logActivity` → CQRS `ActivityLogEvent` (entity `Task`, `previousValues` / `updatedValues`), published by every task create, update (PUT, status route, bulk update, GraphQL) and member change | a CQRS handler turns the facts that matter (status, assignees, parent, priority, due date) into one outbox row |
| Durable, async, once per consumer | the event outbox (`EventOutboxService.append`, `EventConsumerRegistry`, the dispatch pass and its delivery records) | event `task_automation.task_changed`, partition `task-automation:<taskId>`; consumer `subscriber:task-automations` |
| Writes with the platform's side effects | `TaskUpdateCommand` → `TaskService.update` | every task action |
| A system actor in the background | `RequestContext.runWithRequest` with a synthetic user (the pattern of `linear-process.ts`, `inbox-delivery-context.ts`) | user with the rule's tenant and organization, no employee, no permission, and the automation marker (rule, run, depth) |
| Attribution | `ActivityLog` entity subscriber hook (`BaseEntityEventSubscriber.beforeEntityCreate`) | an activity row written inside an automation context gets `actorType = System` and "by automation `<name>`" |
| Notices | `INBOX_ITEM_WRITER` (`upsertExternal`, NOTICE); `EmployeeNotificationService.publishNotificationEvent` (`TASK_UPDATE`) | Inbox when loaded, platform notification otherwise |
| Schedules | `@ScheduledJob` + `@QueueWorker` (`@gauzy/scheduler`), `isSchedulerQueueRootEnabled` (the Inbox sweep's layout) | queue `task-automation-maintenance`, job `task-automation.due-sweep`, every 15 min; a Postgres advisory lock keeps one sweep at a time |
| Tri-dialect migrations | the Inbox plugin's `migration-helpers.ts` | copied (the plugin owns its helpers, as each plugin does) |
| Role grants | `SeedChatRolePermissions` / `DEFAULT_ROLE_PERMISSIONS` | `TASK_AUTOMATION_MANAGE` for super admin, admin, manager |
| "A linked pull request or issue closed" (T16) | core `TaskLinkClosedEvent` (CQRS), published by the GitHub integration (`GithubTaskLinkService`, hooks `pull_request.closed` / `issues.closed`) | `TaskAutomationLinkClosedCapture` appends `task_link.closed` once per task and link |

## 3. Data model

`task_automation_rule` (base tenant + organization columns, plus):

| Column | Type | Notes |
| --- | --- | --- |
| `name` | varchar(120) | required |
| `description` | text | nullable |
| `projectId` / `organizationTeamId` | uuid | nullable scope; FK cascade (a rule of a deleted project goes with it) |
| `isEnabled` | boolean | default false |
| `position` | int | order within the organization |
| `templateKey` | varchar(64) | nullable, display only |
| `triggerType` | varchar(32) | indexed with `organizationId`, `isEnabled` |
| `triggerConfig`, `conditions`, `actions` | text | JSON (text on every dialect: one code path for both ORMs) |
| `lastRunAt` | timestamp | nullable |

`task_automation_run` (base columns, plus): `ruleId` (FK cascade), `taskId` (no FK: a run outlives its task),
`eventKey` varchar(160) — `<eventId>:<taskId>` for a change, `due:<taskId>:<dueDate>` for the schedule — unique with
`ruleId` (the idempotency key), `triggerType`, `outcome` varchar(24), `depth` int, `details` text (JSON), `error` text,
`durationMs` int. Indexes `(ruleId, createdAt)` (history) and `(taskId, createdAt)` (rate limit).

`task_automation_link_closure` (base columns, plus): `taskId` (no FK), `provider` varchar(32), `kind` varchar(24),
`externalId` varchar(255) — unique `(tenantId, taskId, provider, kind, externalId)`: the closed links already handed to
the automations (T16).

Migrations: `1791000007810-CreateTaskAutomationTables`, `1791000007820-SeedTaskAutomationRolePermissions`,
`1791000009110-CreateTaskAutomationLinkClosureTable` (idempotent, Postgres-serialised, reversible table drop; the
grant's `down` is a no-op as for the other seeds).

## 4. Event flow

```text
person saves a task (API request)
  └─ TaskService.update → logActivity → ActivityLogEvent (CQRS, in the request's context)
       └─ TaskAutomationChangeCapture: entity Task? relevant fields changed? any enabled rule of that trigger
          in the organization (30 s cache)? → EventOutboxService.append(task_automation.task_changed,
          { taskId, action, changes, depth, chain })   (after the task's commit, best effort — as realtime hints)
dispatch pass (queue job in the API; inline sweep without a queue)
  └─ TaskAutomationEventConsumer.handle(envelope)      (delivery record = once per event)
       └─ TaskAutomationEngine.processChange: depth ≤ 1; rules of the org in position order whose trigger matches;
          per (rule, subject task): run row claimed by (ruleId, eventKey) — a duplicate is skipped — scope,
          rate limit, conditions on the re-read task, actions through TaskUpdateCommand inside the system-actor
          context (marker: rule, run, depth + 1, chain + rule) → the change's own ActivityLogEvent is captured
          with depth + 1, and the ActivityLog row is attributed to the rule
GitHub delivers pull_request.closed / issues.closed (signature verified; T16)
  └─ GithubTaskLinkService: the organizations that bound the installation (setting installation_id) → in each, the
     tasks linked to the item: a task link to its address (resource_link, entity Task), the task's upper-case reference
     in the pull request's title or branch (TaskService.resolveReferences), the task mirroring the issue (integration
     map, entity Issue, this integration) → read back in the organization → TaskLinkClosedEvent per task (CQRS); an
     organization that failed is thrown back once all were tried (the receiver logs it)
  └─ TaskAutomationLinkClosedCapture: task of the named scope? LINK_CLOSED rule on in the organization (30 s cache)?
     in ONE transaction: claim (tenantId, taskId, provider, kind, externalId) in task_automation_link_closure (taken →
     nothing) + EventOutboxService.append(task_link.closed, partition task-automation:<taskId>) — both commit or
     neither (under MikroORM the claim joins the outbox's MikroORM transaction through its SQL client)
  └─ TaskAutomationEventConsumer → TaskAutomationEngine.processLinkClosed (run key <eventId>:<taskId>)
schedule (worker fires every 15 min; the queue job runs in the API)
  └─ TaskAutomationDueSweepService: advisory lock; enabled DUE_DATE_PASSED rules; open tasks of each rule's scope
     due in (max(now − 24 h, rule.createdAt), now]; run key due:<taskId>:<dueDate>
```

The worker process does not host core's task services, so the plugin is split as the outbox is: the API loads
`TaskAutomationsPlugin` (everything, including the consumers of both queues); the worker loads
`TaskAutomationsSchedulePlugin`, which registers the queue and the `@ScheduledJob` that enqueues onto it and nothing
else. Without a queue root (a single container) the API runs the sweep on an in-process 15-minute timer under the same
lock.

## 5. Rules of evaluation

- **Triggers** (`TaskAutomationTriggerEnum`): `TASK_CREATED`, `STATUS_CHANGED` (`toStatuses` / `fromStatuses`, matched
  on the status value or id), `TASK_ASSIGNED` (members added), `ALL_SUBTASKS_DONE` and `SUBTASK_REOPENED` (subject =
  the parent), `DUE_DATE_PASSED` (schedule), `LINK_CLOSED` (event `task_link.closed`; the GitHub integration reports
  closed pull requests, merged or not, and closed issues — Linear, Asana and Trello attachments carry no state to
  report, spec FR-20).
- **Done** = the task's `TaskStatus` has `isDone`, else its status value is `done`, `completed` or `closed`. **To-do /
  in progress** likewise (`isTodo` / `isInProgress`, else `open`, `backlog` / `in-progress`). A cancelled task counts
  as done for "all sub-tasks done" and as not open for the due-date trigger.
- **Status by category** (`SET_STATUS` with `category`): the first status (by `order`) of the task's project with
  the flag, else of the organization, else the matching default status value.
- **Loop guard**: the marker on the system actor carries `depth` and `chain` (rule ids); the capture writes
  `depth + 1` and the chain; the consumer evaluates nothing for `depth > 1` (`TASK_AUTOMATION_MAX_DEPTH = 1`) and
  skips (records `LOOP_GUARD`) the rules already in the chain.
- **Rate limit**: `APPLIED` runs of the task in the last 10 minutes ≥ 20 → `RATE_LIMITED`.
- **Outcomes**: `APPLIED`, `NO_CHANGE`, `CONDITIONS_NOT_MET`, `LOOP_GUARD`, `RATE_LIMITED`, `FAILED`, `PARTIAL`
  (some actions failed). `TRIGGER_NOT_MATCHED` is never stored (it would record every change × every rule).
- **History**: the last 200 runs per rule are kept once they are a day old; older ones are deleted when a run is
  recorded (one bounded delete per run). A run younger than a day (`TASK_AUTOMATION_RUN_DEDUPE_MS`, the due sweep's
  lookback and an hour) is kept whatever the count, and a run still `RUNNING` is never deleted: their keys are the
  once-per-change guard.
- **One run of a task at a time**: the outbox hands one task's changes over in order, but the due sweep and the parent
  triggers (from each sub-task's partition) reach a task from elsewhere, so each run holds a lock on its task across
  the processes (the sweep's lock kind: Postgres advisory, MySQL `GET_LOCK`, in-process on SQLite) over its read,
  checks, write and outcome. A run that finds the task busy for 2 s, or its own claim still `RUNNING` inside its
  5-minute lease, is put back (`TaskAutomationRetryLaterError`): the outbox retries it with its backoff, the sweep on
  its next pass. Lock connections are bounded by the pool (half of it, at most 4); a pool that cannot spare two keeps
  to the in-process guard.
- **Capture cache**: each API instance trusts what it read of an organization's enabled triggers for 30 s, so a rule
  switched on on one instance fires for changes made on another from at most 30 s later.

## 6. Modules (`packages/plugins/task-automations/src/lib`)

| Module | Responsibility |
| --- | --- |
| `task-automations-enabled.ts` | `isTaskAutomationsEnabled` (exact `true`, warns once on another value) |
| `entities/` | `TaskAutomationRule`, `TaskAutomationRun` + MikroORM repositories |
| `database/` | migration helpers and the two migrations |
| `engine/` | pure functions: `triggers.ts`, `conditions.ts`, `actions.ts` (plan), `status-categories.ts`, `loop-guard.ts`, `templates.ts`, `change-capture.ts` (fact → change) |
| `services/task-automation-rule.service.ts` | CRUD, validation, reorder, limits, scope checks |
| `services/task-automation-runner.service.ts` | one rule × one task: claim run, guards, conditions, actions through the writer, record outcome, prune |
| `services/task-automation-engine.service.ts` | a change → matching rules and subjects; dry run |
| `services/task-automation-task-reader.service.ts` | the task snapshot the engine reads (status, flags, members, tags, parent, sub-tasks) |
| `services/task-automation-writer.service.ts` | `TaskUpdateCommand` inside the system actor's context; notices |
| `services/task-automation-link-closure.store.ts` | the once-per-task-and-link claim of a closed link |
| `events/` | `TaskAutomationChangeCapture` and `TaskAutomationLinkClosedCapture` (CQRS handlers → outbox), `TaskAutomationEventConsumer` (outbox), `TaskAutomationActivitySubscriber` (attribution) |
| `schedule/` | scheduler, worker, due sweep, in-process fallback timer |
| `task-automation.controller.ts`, `dto/` | REST |
| `graphql/` | `taskAutomationRules`, `taskAutomationRule`, `taskAutomationRuns`, `taskAutomationTemplates` |

## 7. API

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /task-automations/templates` | `TASK_AUTOMATION_MANAGE` | the built-in templates |
| `GET /task-automations?projectId=&organizationTeamId=` | `TASK_AUTOMATION_MANAGE` | the organization's rules in position order |
| `GET /task-automations/:id` | `TASK_AUTOMATION_MANAGE` | |
| `POST /task-automations` | `TASK_AUTOMATION_MANAGE` | `{ templateKey?, name, … }` — a template fills what the body leaves out |
| `PUT /task-automations/:id` | `TASK_AUTOMATION_MANAGE` | partial: name, description, scope, `isEnabled`, trigger, conditions, actions |
| `PUT /task-automations/order` | `TASK_AUTOMATION_MANAGE` | `{ ids }` — the organization's rules in their new order |
| `DELETE /task-automations/:id` | `TASK_AUTOMATION_MANAGE` | with its runs |
| `POST /task-automations/:id/test` | `TASK_AUTOMATION_MANAGE` | `{ taskId }` → the dry run |
| `GET /task-automations/:id/runs?limit=` | `TASK_AUTOMATION_MANAGE` | newest first, at most 50 |

The organization is the caller's current one (`organization-id`, validated by the platform); a body or query
`organizationId` that names another one is refused.

## 8. Tests

Unit specs for each trigger, condition and action (pure functions), the status categories, the loop guard and the
rate limit, the change capture (activity fact → change), the runner (idempotent claim, outcomes, partial failure),
the engine (rule order, scope, subjects for the parent triggers), the dry run (no write), the due sweep (window,
once per due date), the DTO validation, the flag, the plugin lists of the API and the worker, and the migration on
SQLite. Closed links (T16): the link capture (units); the closure table and a closed pull request end to end on SQLite
(report → capture → outbox → consumer → engine: the task moves once; a redelivery, another tenant or organization, a
missing task append nothing); the GitHub report on SQLite (`github-task-link.service.spec.ts`: links, references,
mirrored issues, the organizations of the installation, deleted tasks, redelivery), its address and reference parsing,
and its hooks.

## 9. Phases

1. Platform (this PR): contracts, plugin, migrations, REST + GraphQL reads, specs.
2. Angular: `@gauzy/plugin-task-automations-ui` (Settings → Automations).
3. Ever Teams: Settings → Automations, 13 locales.
4. T16: the GitHub integration reports closed linked pull requests and issues (`task_link.closed`).
