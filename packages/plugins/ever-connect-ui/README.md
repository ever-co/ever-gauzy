# @gauzy/plugin-ever-connect-ui

**Integrations > Ever Platform** (`/pages/integrations/ever-connect`), the web part of [`@gauzy/plugin-ever-connect`](../ever-connect/README.md).

The page asks the API first. Where the API's Ever Platform module is not loaded (the default: `EVER_CONNECT_ENABLED` unset), it only says so and makes no other request.

| Tab                 | Who                                                                                          | What                                                                                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection          | the operator of the installation ("Operated by Ever Cloud" with `EVER_INSTALL_SOURCE=cloud`) | what connecting sends, the connect code, the state of the connection, the approvals requested for installation-wide integrations (Accept / Decline, with what would start moving), the instance policy, Disconnect                     |
| Organization link   | administrators of the organization                                                           | link it with a link code from app.ever.co, or remove the link                                                                                                                                                                          |
| Integrations & data | everyone with `INTEGRATION_VIEW`                                                             | each integration, its state, **Show scope** (what leaves the installation, why, how often, what Ever Platform keeps), **Enable in app.ever.co…** (opens the consent screen; the page reads the result when you come back), **Disable** |
| Entitlements        | everyone with `INTEGRATION_VIEW`                                                             | the verified entitlement documents of the organization and of the installation, Refresh                                                                                                                                                |
| Audit               | everyone with `INTEGRATION_VIEW`                                                             | what happened to the connection, the links and the integrations                                                                                                                                                                        |

Nothing is enabled from this page: an owner or administrator of the linked Ever organization consents in app.ever.co.

Translations are the plugin's own (`src/i18n/en.json`, namespace `EVER_CONNECT`).
