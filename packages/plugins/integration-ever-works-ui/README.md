<!-- markdownlint-configure-file
{"MD043":{"headings":["# @gauzy/plugin-integration-ever-works-ui"]}}
-->

# @gauzy/plugin-integration-ever-works-ui

**Integrations > Ever Works** (`/pages/integrations/ever-works`, and
`/pages/integrations/ever-works/:integrationTenantId` for a connected
organization), the web part of
[`@gauzy/plugin-integration-ever-works`](../integration-ever-works/README.md).

The page asks the API first (`GET /api/integration/ever-works/status`). Where
the API's Ever Works plugin is not loaded (the default: `EVER_WORKS_ENABLED`
unset), the API answers 404 and the page only says so and makes no other
request.

Where the plugin is loaded, the page reads the tenant's connection and the
selected organization's mapping. A mapped organization links to its sync
settings; any other one gets the **connect wizard** (plan item G-P1-11):

1. **Integration key**: the steps to create an Ever Works integration key, with
   a link to the Ever Works page that creates one with the "Ever Gauzy" preset
   (only when the operator set `EVER_WORKS_APP_URL`, HTTPS only).
2. **Connect**: the API URL (prefilled from `EVER_WORKS_API_URL`) and the key,
   **Validate** (the Ever Works tenant, the pinned organizations, the scopes,
   the API version; missing preset scopes are a warning, missing required ones
   and an incompatible version block the connect), then **Connect**. The key is
   sent once, stored encrypted by the API and cleared from the form.
3. **Organization**: map this organization to one of the key's pinned Ever
   Works organizations (a connected tenant starts here).
4. **Review matches**: People, Agents, Teams and Projects. Suggestions are
   preselected and nothing is paired until saved; teams and projects can be
   created on the other side where the mapping allows it.
5. **Entities and directions**: one direction per synced domain (only the
   directions that domain allows) and whether tasks of projects not paired with
   a work sync too.
6. **Preview and start**: the dry run per phase (records on each side, pairs,
   what the sync creates, what is still to pair; phases this installation does
   not sync yet are greyed with the reason), then **Start**: the webhook is
   registered (best effort; the change feed keeps the sync going without it)
   and the first sync starts.

The page names no Ever Works address of its own: every address it shows comes
from the API's configuration or from what the admin typed.

It is a declarative plugin (`defineDeclarativePlugin`) with standalone,
lazy-loaded routes, registered in `apps/gauzy/src/plugin-ui.config.ts`.
Translations are the plugin's own (`src/i18n/en.json`, namespace `EVER_WORKS`).

```sh
yarn nx build plugin-integration-ever-works-ui --configuration=production
yarn nx test plugin-integration-ever-works-ui
```
