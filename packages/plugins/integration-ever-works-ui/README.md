# @gauzy/plugin-integration-ever-works-ui

**Integrations > Ever Works** (`/pages/integrations/ever-works`, and
`/pages/integrations/ever-works/:integrationTenantId` for a connected
organization), the web part of
[`@gauzy/plugin-integration-ever-works`](../integration-ever-works/README.md).

The page asks the API first (`GET /api/integration/ever-works/status`). Where
the API's Ever Works plugin is not loaded (the default: `EVER_WORKS_ENABLED`
unset), the API answers 404 and the page only says so and makes no other
request.

This version is the scaffold: it shows that the integration is switched on, the
Ever Works API URL the operator configured (`EVER_WORKS_API_URL`) and, when
`EVER_WORKS_APP_URL` is set, a link to the Ever Works page that creates an
integration key with the "Ever Gauzy" preset. The page names no Ever Works
address of its own: every address it shows comes from the API's configuration.
The connect wizard, the organization mapping and the sync settings and activity
tabs follow (plan item G-P1-11).

It is a declarative plugin (`defineDeclarativePlugin`) with standalone,
lazy-loaded routes, registered in `apps/gauzy/src/plugin-ui.config.ts`.
Translations are the plugin's own (`src/i18n/en.json`, namespace `EVER_WORKS`).

```sh
yarn nx build plugin-integration-ever-works-ui --configuration=production
yarn nx test plugin-integration-ever-works-ui
```
