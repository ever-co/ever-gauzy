# @gauzy/plugin-integration-trello-ui

Integrations → Trello in the Ever Gauzy web app: the page of the `@gauzy/plugin-integration-trello` API plugin
(`packages/plugins/integration-trello`).

- `/pages/integrations/trello` — the organization's status: where the API's Trello plugin is not loaded
  (`TRELLO_ENABLED` off) the page only says so; where the application is not configured it says that; otherwise
  **Connect Trello** asks the API for a single-use state and sends the person to Trello's authorize page. Trello
  brings them back here with the token in the URL fragment (`#token=`) and the state in the query; the page hands
  both to the API (`POST /integration/trello/connect`), the settings open and the token leaves the address.
- `/pages/integrations/trello/:integrationId` — the connection: the member, whether the server takes webhooks, a
  way to disconnect; the board ↔ project mappings (a board the member can see and not mapped yet, a project of the
  organization, a direction, the task status per list of the board — blank means the list's name when it is a
  status, else open — and the switch), the webhook of each mapping (registered, or a way to register it again),
  **Import changes** / **Import everything** per mapping, and the latest runs with their counts and errors (read
  again every ten seconds while one runs).

Registered declaratively (`defineDeclarativePlugin`, namespace `TRELLO`, translations in `src/i18n/en.json`);
listed in `apps/gauzy/src/plugin-ui.config.ts`. The catalogue card opens it through its `redirectUrl` (`trello`).

```bash
yarn nx build plugin-integration-trello-ui
yarn nx test plugin-integration-trello-ui
```
