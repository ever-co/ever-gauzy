# @gauzy/plugin-integration-linear-ui

Integrations → Linear in the Ever Gauzy web app: the page of the `@gauzy/plugin-integration-linear` API
plugin (`packages/plugins/integration-linear`).

- `/pages/integrations/linear` — the organization's status: where the API's Linear plugin is not loaded
  (`LINEAR_ENABLED` off) the page only says so; where the OAuth application is not configured it says that;
  otherwise **Connect Linear** asks the API for a single-use state and sends the person to Linear's authorize
  page. The API's callback brings them back here with `?integrationId=` (the settings open) or `?error=`.
- `/pages/integrations/linear/:integrationId` — the connection: the workspace, a way to disconnect; the team ↔
  project mappings (a team, a project of the organization, a direction, the task status per Linear state kind,
  the switch), **Import changes** / **Import everything** per mapping, and the latest runs with their counts
  and errors (read again every ten seconds while one runs).

Registered declaratively (`defineDeclarativePlugin`, namespace `LINEAR`, translations in `src/i18n/en.json`);
listed in `apps/gauzy/src/plugin-ui.config.ts`. The catalogue card opens it through its `redirectUrl` (`linear`).

```bash
yarn nx build plugin-integration-linear-ui
yarn nx test plugin-integration-linear-ui
```
