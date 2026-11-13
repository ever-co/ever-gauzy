# @gauzy/plugin-task-automations-ui

Settings → Automations for the Ever Gauzy app: the organization's task automation rules
([`@gauzy/plugin-task-automations`](../task-automations/README.md), spec
[`docs/specs/features/task-automations`](../../../docs/specs/features/task-automations/)).

- **List** in the order the rules run: switch a rule on or off, move it up or down (or drag it).
- **Create** blank or from a built-in template; **edit** the name, description, scope (a project, a team), the trigger
  (with the statuses a status change waits for), the conditions and the actions; **delete** a rule with its runs.
- **Test** a rule on a task (the dry run: trigger, conditions, the changes it would make — nothing is written) and read
  its **recent runs** with their outcome.

The page is `/pages/settings/automations` (`TASK_AUTOMATION_MANAGE`). The Settings entry appears only where the API
loads task automations (`GAUZY_TASK_AUTOMATIONS_ENABLED=true`) and answers the signed-in user
(`TaskAutomationsAvailabilityService` asks `GET /api/task-automations/templates`; a 404 or 403 hides it). Elsewhere the
route only says the feature is off.

Registered in `apps/gauzy/src/plugin-ui.config.ts`. Tests:

```bash
node node_modules/jest/bin/jest.js -c packages/plugins/task-automations-ui/jest.config.ts
```
