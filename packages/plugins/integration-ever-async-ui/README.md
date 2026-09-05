# @gauzy/plugin-integration-ever-async-ui

Angular UI plugin for the [Ever Async](https://github.com/ever-co/ever-async) integration —
rendered under **Integrations → Ever Async** in the Gauzy web app.

> **STATUS: structural draft scaffold.** This package mirrors the file topology and conventions of
> `@gauzy/plugin-integration-plane-ui` but is not yet wired into the workspace builds. See the wiring
> checklist in the pull request description and the `// scaffold:` comments in the sources.

## What it provides

- `IntegrationEverAsyncPlugin` — a `PluginUiDefinition` registering the
  `/pages/integrations/ever-async` route at the `integrations-sections` location.
- **Connect wizard** (`EverAsyncConnectComponent`): form with the Ever Async server URL, a
  write-only API token, and a **Test connection** button that pings the server's `/healthz` through
  the Gauzy API (`POST /api/integration/ever-async/verify`).
- `EverAsyncService` — package-local HTTP client for the
  `@gauzy/plugin-integration-ever-async` backend endpoints.

Planned follow-ups per the
[integration contract](https://github.com/ever-co/ever-async/blob/main/docs/integrations/gauzy.md):
a settings page with the chat-user → employee mapping table and per-project enable toggles.

## Building

Run `yarn nx build plugin-integration-ever-async-ui` to build the library (after the wiring steps in
the PR description are applied).

## Installation

Install the Integration Ever Async UI Plugin using your preferred package manager:

```bash
npm install @gauzy/plugin-integration-ever-async-ui
# or
yarn add @gauzy/plugin-integration-ever-async-ui
```
