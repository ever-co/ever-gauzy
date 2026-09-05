# @gauzy/plugin-integration-ever-async

Ever Gauzy Platform plugin for integration with [Ever Async](https://github.com/ever-co/ever-async) —
an open-source, async-first team communication assistant that brings work context (tasks, projects)
from tools like Gauzy, Jira and GitHub into chat platforms (Slack/Discord).

> **STATUS: structural draft scaffold.** This package mirrors the file topology and conventions of
> `@gauzy/plugin-integration-plane` but is not yet wired into the workspace builds. See the wiring
> checklist in the pull request description and the `// scaffold:` comments in the sources.

## Integration contract

The two halves of the integration are described in the Ever Async repo:
[`docs/integrations/gauzy.md`](https://github.com/ever-co/ever-async/blob/main/docs/integrations/gauzy.md)

- **Ever Async side** (`crates/plugins/connector-gauzy` in `ever-co/ever-async`): a `ConnectorPlugin`
  that consumes the Gauzy REST API (Bearer token + `Tenant-Id` header) to resolve chat messages like
  "my last task" into task links + status.
- **Gauzy side** (this plugin pair): stores the Ever Async server URL, manages the API token the
  connector uses (write-only), and manages the chat-user → employee mapping that the connector's
  `[connectors.gauzy.user_map]` config consumes. The companion Angular package
  `@gauzy/plugin-integration-ever-async-ui` renders the connect wizard under
  **Integrations → Ever Async**.

## What this plugin provides

REST endpoints under `/api/integration/ever-async` (guarded by `TenantPermissionGuard` +
`PermissionGuard`, mirroring the Plane integration):

| Method | Path                    | Permission           | Purpose                                                |
| ------ | ----------------------- | -------------------- | ------------------------------------------------------ |
| POST   | `/setup`                | `INTEGRATION_ADD`    | Store server URL + API token (write-only) + mappings   |
| GET    | `/settings`             | `INTEGRATION_VIEW`   | Read settings (token never returned, only `hasApiToken`) |
| PUT    | `/settings`             | `INTEGRATION_EDIT`   | Partial update of URL / token / mappings               |
| POST   | `/verify`               | `INTEGRATION_VIEW`   | Ping the Ever Async server's `/healthz`                |
| GET    | `/status`               | `INTEGRATION_VIEW`   | Is the integration enabled for this tenant?            |
| DELETE | `/:integrationTenantId` | `INTEGRATION_DELETE` | Soft-archive the integration                           |

Settings are persisted as `IntegrationSetting` rows (see `EverAsyncSettingName`):
`EVER_ASYNC_SERVER_URL`, `EVER_ASYNC_API_TOKEN` (write-only), `EVER_ASYNC_USER_MAPPINGS`
(JSON array of `{ chatUserId, employeeId }`), `IS_ENABLED`.

## Building

Run `yarn nx build plugin-integration-ever-async` to build the library (after the wiring steps in the
PR description are applied).

## Installation

Install the Integration Ever Async Plugin using your preferred package manager:

```bash
npm install @gauzy/plugin-integration-ever-async
# or
yarn add @gauzy/plugin-integration-ever-async
```
