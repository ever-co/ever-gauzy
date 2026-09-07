<!-- markdownlint-configure-file
{
  "MD043": {
    "headings": [
      "# @gauzy/plugin-integration-ever-async",
      "## Configure the integration",
      "## API boundary",
      "## Build and verification"
    ]
  }
}
-->

# @gauzy/plugin-integration-ever-async

Connect an Ever Gauzy organization to an [Ever Async](https://async.ever.co)
tenant. The connector can read task links and status from explicitly selected
projects. Its credentials cannot modify tasks or access general Gauzy APIs.

## Configure the integration

1. In Gauzy, select the organization and open **Integrations → Ever Async**.
2. Enter the Ever Async API URL, select the projects to share, and map chat
   identities to active employees. Each identity includes its platform,
   workspace or server ID, and user ID. Use the verified workspace ID shown in
   Ever Async **Connections**.
3. Save. Gauzy displays an integration ID, tenant ID, organization ID, API key,
   and one-time API secret.
4. Sign in to Ever Async, select the tenant, and open **Connections**. Add an
   Ever Gauzy connection using those details and the Gauzy API URL. Choose which
   of that tenant's Slack and Discord connections may use the work context.

An empty project selection shares no tasks. An unmapped author receives no
inferred employee task context. Explicit task links still have to belong to a
selected, active project in the configured Gauzy organization. A user ID from a
different platform or workspace is a different identity.

Changing mappings or the project selection takes effect on the next connector
request. Disabling the integration rejects connector access. Rotating
credentials immediately invalidates the previous key and secret; update the
corresponding Ever Async connection with the new credentials. Archiving an
integration preserves its history.

**Test connection** checks the Ever Async server's `/healthz` response. It does
not install a chat application or prove that tenant pairing is configured.

## API boundary

Management routes use the signed-in Gauzy user, tenant permissions, integration
permissions, and active organization membership. Supply `organizationId` as a
query parameter; it must belong to the authenticated tenant and user.

Permissions below use the `INTEGRATION_` prefix. Paths share the
`/api/integration/ever-async` prefix.

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/setup` | `ADD` |
| GET | `/settings` | `VIEW` |
| GET | `/options` | `VIEW` |
| PUT | `/settings` | `EDIT` |
| POST | `/credentials/rotate` | `EDIT` |
| POST | `/verify` | `VIEW` |
| GET | `/status` | `VIEW` |
| DELETE | `/:integrationTenantId` | `DELETE` |

Setup saves settings and returns one-time credentials. Reading settings returns
credential presence, never the secret. Options lists active employees and
projects in the organization. Updating settings changes the URL, mappings,
selected projects, or enabled state. Rotation replaces credentials and returns
the new secret once. Verification checks a public HTTPS Ever Async server.
Status reports this organization's integration state. DELETE soft-archives the
integration and preserves its history.

The separate read-only connector routes require all three headers:
`X-INTEGRATION-ID`, `X-APP-ID` (API key), and `X-API-KEY` (API secret). They
bypass the user JWT guard but always run the dedicated connector credential
guard. The stored credential determines tenant and organization; request headers
and query parameters cannot override that scope.

- `GET /connector/status` returns the authenticated integration, tenant, and
  organization IDs.
- `GET /connector/tasks?channel=slack&workspace=T123&chatUserId=U123` resolves
  the saved employee mapping.
- `GET /connector/tasks?taskId=<uuid>` resolves an explicit task link.

Supply exactly one of `chatUserId` or `taskId`. Responses include at most ten
task summaries and use `Cache-Control: no-store`. Only a salted scrypt digest of
the random API secret is stored in `IntegrationSetting`; plaintext secrets are
returned only by setup and rotation.

## Build and verification

```sh
yarn nx build plugin-integration-ever-async --configuration=production
yarn nx build plugin-integration-ever-async-ui --configuration=production
yarn nx run plugin-integration-ever-async:test-integration
```

Both packages participate in the workspace and Docker builds. The backend is
registered in the API plugin list and packaged into the API/worker images. It
owns no background queue, so the worker does not bootstrap it. The Angular
package is registered in the web application and excluded from backend runtime
package copies. The desktop server manifest includes the backend package.

The integration catalog is seeded for new installations and registered during
application bootstrap for existing installations. It uses existing integration
tables. SQL-backed tests exercise organization membership, project and employee
restrictions, workspace identity isolation, credential storage/rotation,
disabled access, and the actual HTTP credential guard.

For a self-hosted Ever Async server, the Gauzy page also provides an optional
TOML example. Hosted connections are configured per tenant through the Ever
Async dashboard.

Connector endpoints enforce a per-client, per-process rate limit before
credential lookup even when optional global throttling is disabled. The default
is 600 requests per minute; operators can set
`EVER_ASYNC_CONNECTOR_REQUESTS_PER_MINUTE` to a positive integer up to 50000 for
larger installations. The limit covers status and task requests together, and
excess requests return HTTP 429 with `Retry-After`.
