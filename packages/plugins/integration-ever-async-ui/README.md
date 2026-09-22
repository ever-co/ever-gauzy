<!-- markdownlint-configure-file
{"MD043":{"headings":["# @gauzy/plugin-integration-ever-async-ui"]}}
-->

# @gauzy/plugin-integration-ever-async-ui

Angular configuration page for [Ever Async](https://async.ever.co), available at
**Integrations → Ever Async** (`/pages/integrations/ever-async`). It uses the
currently selected Gauzy organization.

The page lets an authorized user select projects, map Slack or Discord
identities to employees, enable or disable sharing, and generate or rotate a
credential for that organization's read-only connector. Chat mappings include
platform, workspace or server ID, and user ID so multiple connected workspaces
remain distinct.

After saving, use the displayed integration details and one-time API credentials
to add an Ever Gauzy connection in the chosen Ever Async tenant's
**Connections** page. Select the Slack and Discord connections for work context
there. A self-hosted TOML example is also available.

Organization changes clear settings, pending credentials, and form state before
loading the new organization's data. Responses from an earlier visit to an
organization are discarded, even after switching back to it. The API
independently verifies organization membership and integration permissions.
Secrets are not returned by settings requests. The reachability check only
verifies the Ever Async `/healthz` endpoint. It does not establish tenant pairing.

Pairing details use the configured `environment.API_BASE_URL`, with the current
web origin as the fallback for same-origin deployments. The Async connector adds
the `/api` prefix to that base itself.

```sh
yarn nx build plugin-integration-ever-async-ui --configuration=production
yarn nx test plugin-integration-ever-async-ui --runInBand
yarn nx lint plugin-integration-ever-async-ui
```

The package is included in the web application's plugin registration, TypeScript
paths, workspace build scripts, and web Docker dependency manifests. See the
[backend package](../integration-ever-async/README.md) for the API contract and
SQL-backed verification command.
