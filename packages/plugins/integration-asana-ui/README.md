# @gauzy/plugin-integration-asana-ui

Integrations → Asana in the Ever Gauzy web app: the page of the `@gauzy/plugin-integration-asana` API plugin
(`packages/plugins/integration-asana`).

- `/pages/integrations/asana` — the organization's status: where the API's Asana plugin is not loaded
  (`ASANA_ENABLED` off) the page only says so; where the OAuth application is not configured it says that;
  otherwise **Connect Asana** asks the API for a single-use state and sends the person to Asana's authorize
  page. The API's callback brings them back here with `?integrationId=` (the settings open) or `?error=`.
- `/pages/integrations/asana/:integrationId` — the connection: the account, whether the server takes webhooks,
  a way to disconnect; the Asana project ↔ project mappings (a workspace, one of its projects not mapped yet, a
  project of the organization, a direction, the task status per section of the Asana project — blank means the
  section's name when it is a status, else open — and the switch), the webhook of each mapping (registered, or
  a way to register it again), **Import changes** / **Import everything** per mapping, and the latest runs with
  their counts and errors (read again every ten seconds while one runs).

Registered declaratively (`defineDeclarativePlugin`, namespace `ASANA`, translations in `src/i18n/en.json`);
listed in `apps/gauzy/src/plugin-ui.config.ts`. The catalogue card opens it through its `redirectUrl` (`asana`).

```bash
yarn nx build plugin-integration-asana-ui
yarn nx test plugin-integration-asana-ui
```
