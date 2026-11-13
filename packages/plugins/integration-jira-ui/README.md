# @gauzy/plugin-integration-jira-ui

Integrations → Jira in the Ever Gauzy web app: the page of the `@gauzy/plugin-integration-jira` API
plugin (`packages/plugins/integration-jira`).

- `/pages/integrations/jira` — the organization's status: where the API's Jira sync is not loaded
  (`JIRA_ENABLED` off) the page only says so; where the OAuth app is not configured it says that;
  otherwise **Connect Jira** asks the API for a single-use state and sends the person to Atlassian's
  authorize page. The API's callback brings them back here with `?integrationId=` (the settings open) or
  `?error=`.
- `/pages/integrations/jira/:integrationId` — the connection: its Jira Cloud site (chosen here when the
  account reaches several; kept while mappings exist), the account, a way to disconnect; its webhook (when it
  expires, why its last registration failed, **Register again**); the Jira project ↔ project mappings (a
  Jira project, a project of the organization, a direction, the task status per status category and,
  optionally, per Jira status, the issue types brought in, the switch), **Import changes** / **Import
  everything** per mapping, the sync conflicts, and the latest runs with their counts, report and errors
  (read again every ten seconds while one runs).

Registered declaratively (`defineDeclarativePlugin`, namespace `JIRA`, translations in `src/i18n/en.json`);
listed in `apps/gauzy/src/plugin-ui.config.ts`. The catalogue card opens it through its `redirectUrl` (`jira`).

```bash
yarn nx build plugin-integration-jira-ui
yarn nx test plugin-integration-jira-ui
```
