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
4. **Review matches**: People, Agents, Teams, Projects and Initiatives ↔
   Missions. Suggestions are preselected and nothing is paired until saved;
   teams, projects and initiatives can be created on the other side where the
   mapping allows it (a mission created from Gauzy starts paused; a draft
   initiative waits until it is active). On People, a shared Ever ID pairs by
   itself and each pairing shows how it was made (Ever ID, verified email, by
   hand); an unpaired member can be invited to Gauzy (Employee role) and an
   unpaired Gauzy person to Ever Works, each after a confirmation that names
   the organization and role. An invitation pairs nobody.
5. **Entities and directions**: one direction per synced domain (only the
   directions that domain allows) and whether tasks of projects not paired with
   a work sync too.
6. **Preview and start**: the dry run per phase (records on each side, pairs,
   what the sync creates, what is still to pair; phases this installation does
   not sync yet are greyed with the reason), then **Start**: the webhook is
   registered (best effort; the change feed keeps the sync going without it)
   and the first sync starts.

The **sync settings** of a mapping (`/pages/integrations/ever-works/:integrationTenantId`,
the address the list of connected integrations opens) are in tabs:

- **Overview**: the connection's state, how far Gauzy is behind Ever Works' change
  feed, the queues both ways (pending, deferred, retrying, stopped), open
  conflicts, the last error, the pairs per record type and the running or last
  sync with its phases (read again every 10 seconds while it runs); Resync,
  cancel a running sync, pause and resume. A mapping that never synced offers
  the dry run and Start.
- **Mapping**: the match review (people, agents, teams, projects, initiatives ↔
  missions).
- **Entities and directions**.
- **Activity**: the conflicts (open, resolved or all; both values and the side
  that won; **Keep** or **Use the other value**) and the sync log (filters by
  status and direction, more pages).
- **Advanced**: sync this organization on or off, replace the integration key
  (it must belong to the same Ever Works tenant; the field is cleared once the
  API has it), register the webhook again, and disconnect (asked twice; synced
  data stays on both sides).

Only the selected organization's own mapping is shown; another organization's
mapping is not.

The page names no Ever Works address of its own: every address it shows comes
from the API's configuration or from what the admin typed.

It is a declarative plugin (`defineDeclarativePlugin`) with standalone,
lazy-loaded routes, registered in `apps/gauzy/src/plugin-ui.config.ts`.
Translations are the plugin's own (`src/i18n/en.json`, namespace `EVER_WORKS`).

```sh
yarn nx build plugin-integration-ever-works-ui --configuration=production
yarn nx test plugin-integration-ever-works-ui
```
