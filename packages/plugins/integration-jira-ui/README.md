# @gauzy/plugin-integration-jira-ui

Integrations → Jira in the Ever Gauzy web app: the page of the `@gauzy/plugin-integration-jira` API
plugin (`packages/plugins/integration-jira`).

- `/pages/integrations/jira` — the organization's status: where the API's Jira plugin is not loaded
  (`JIRA_ENABLED` off) the page only says so; where the OAuth application is not configured it says that;
  otherwise **Connect Jira** asks the API for a single-use state and sends the person to Jira's authorize
  page. The API's callback brings them back here with `?integrationId=` (the settings open) or `?error=`.
- `/pages/integrations/jira/:integrationId` — the connection: the workspace, a way to disconnect; the team ↔
  project mappings (a team, a project of the organization, a direction, the task status per Jira state kind,
  the switch), **Import changes** / **Import everything** per mapping, and the latest runs with their counts
  and errors (read again every ten seconds while one runs).

Registered declaratively (`defineDeclarativePlugin`, namespace `JIRA`, translations in `src/i18n/en.json`);
listed in `apps/gauzy/src/plugin-ui.config.ts`. The catalogue card opens it through its `redirectUrl` (`jira`).

```bash
yarn nx build plugin-integration-jira-ui
yarn nx test plugin-integration-jira-ui
```
