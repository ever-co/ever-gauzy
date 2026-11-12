# @gauzy/plugin-task-automations

Task automations for the Ever Gauzy Platform: rules of an organization — optionally narrowed to a project or a team —
made of a **trigger**, **conditions** and **actions**, run in the background after the task change that set them off
(or on a schedule for due dates), with a dry run and a run history per rule.

Spec, plan and tasks: [`docs/specs/features/task-automations`](../../../docs/specs/features/task-automations/).

## Switch

Off unless `GAUZY_TASK_AUTOMATIONS_ENABLED=true` (exactly), on the API and the worker alike. Off, nothing is loaded:
no route, no GraphQL field, no table, no outbox row, no schedule, no role grant.

## What it does

- **Triggers**: a task is created; its status changes (optionally to / from given statuses); someone is added as an
  assignee; every sub-task of a task is done (acts on the parent); a done sub-task is reopened (acts on the parent);
  the due date of an open task passes (every 15 minutes); a linked pull request or issue closes (`task_link.closed`,
  appended by an integration).
- **Conditions** (all must hold): status is / is not / of category; open / done; priority; labels; assigned /
  unassigned / assignee; sub-task or not; title contains.
- **Actions** (in order): set the status (a status, or the first to-do / in-progress / done status of the task's
  project); set the priority; add or replace assignees; add or remove labels; notify the assignees (Inbox notice, or a
  platform notification without the Inbox).
- **Templates**: close the parent when all sub-tasks are done; reopen the parent when a sub-task reopens; when the
  status changes set the assignee / label / priority; when assigned move to In progress; when the due date passes
  notify the assignees; when a linked pull request or issue closes set the status.

## How it runs

1. Every task create, update and assignee change publishes the platform's `ActivityLogEvent` with the values before
   and after. `TaskAutomationChangeCapture` turns the ones a switched-on rule could fire on into
   `task_automation.task_changed` on the event outbox (partition `task-automation:<taskId>`).
2. The outbox dispatch pass hands the event to `subscriber:task-automations` once; the engine runs the organization's
   matching rules in their order. Each run is claimed by `(ruleId, eventKey)`, so a redelivered change runs nothing.
3. Actions go through `TaskUpdateCommand` inside a request context of a system actor of the rule's organization (no
   user, no employee, no permission), so notifications, subscriptions, integrations and real-time hints follow, and the
   activity row says "by automation `<name>`" with the system as actor.
4. Loop guard: a rule's change may set off other rules once; their changes set off nothing; a rule never runs on its own
   change. Rate limit: at most 20 automated changes per task in 10 minutes.
5. One run of a task at a time, across the processes (a lock per task over the read, the checks, the write and the
   recorded outcome); a run that finds its task busy is put back and tried again.

The worker hosts `TaskAutomationsSchedulePlugin` (the due-date schedule only); the API hosts `TaskAutomationsPlugin`
(everything else, including the consumer of the schedule's queue). Without a queue root the API sweeps on its own timer;
with one (`REDIS_ENABLED=true`) the sweep comes from the worker's schedule, so keep the worker's scheduler on.

## API

`TASK_AUTOMATION_MANAGE` (granted to super admins, admins and managers) on every route of `/api/task-automations`:
`GET /templates`, `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `PUT /order`, `DELETE /:id`, `POST /:id/test`,
`GET /:id/runs`. GraphQL: `taskAutomationRules`, `taskAutomationRule`, `taskAutomationRuns`, `taskAutomationTemplates`.

## Tests

```bash
NODE_OPTIONS=--experimental-vm-modules node node_modules/jest/bin/jest.js -c packages/plugins/task-automations/jest.config.ts
```
