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

## Check on Ever Platform

On a contact (**Contacts > a contact**, in the header), for everyone with `INTEGRATION_VIEW`, shown only while **Check contacts on Ever Platform** is enabled for the organization in app.ever.co and its entitlement includes the feature. Otherwise nothing is rendered; where the API's Ever Platform module is not loaded, its 404 hides the button too.

- **Check on Ever Platform** opens a check of the contact: its e-mail (from the contact), a VAT number and a registration number (typed; the contact's fiscal information is offered as a suggestion to edit) and the country they belong to. The result shows, for each identifier, the `ever.co/<handle>` of an organization that chose to be discoverable and what it offers, "No discoverable organization found", or why it cannot be checked. Nothing is written back to the contact.
- The browser sends the values to this installation's API only (`POST /api/ever-connect/lookup`); the API hashes them and sends Ever Platform the hashes. The web app never calls Ever Platform.
- **Check a contact automatically when it is opened**, on the integration's row of **Integrations & data** (`INTEGRATION_EDIT`), is off by default. When on, opening a contact checks its e-mail once; when off, nothing is checked until the button is clicked.

The button is contributed to the contact page through the extension slot `contact-view-actions` of `@gauzy/plugin-ui`, so the contact page itself does not depend on this plugin.

Translations are the plugin's own (`src/i18n/en.json`, namespace `EVER_CONNECT`).
