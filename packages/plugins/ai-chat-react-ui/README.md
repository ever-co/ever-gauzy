# @gauzy/plugin-ai-chat-react-ui

React AI agent chat for the Gauzy platform, built with the [Vercel AI SDK](https://ai-sdk.dev)
(`@ai-sdk/react` v4 / AI SDK 7). The backend engine is
[`@gauzy/plugin-ai-chat`](../ai-chat) (`POST /api/ai-chat`).

The chat renders in a **dedicated sidebar slot** between the navigation menu and the page
content — `Menu | Chat | Canvas` — so the agent can talk to the user while opening any platform
page and filling forms right next to the conversation.

## Features

- **Chat sidebar** — full-height panel in the layout's chat slot; collapse/expand via the header
  toggle, the in-panel chevron or `Escape`; state persisted per browser
- **Agentic** — streams tool calls live: server tools (tasks, projects, timer, invoices, … — all
  executed with the user's own permissions) and client "canvas" tools:
  `list_pages` / `open_page` / `read_page` / `fill_form` / `submit_form`
- **Human-in-the-loop** — mutating tools (e.g. `submit_form`, `create_task`) render inline
  Approve / Reject buttons and only run after explicit approval
- **Markdown** — assistant responses rendered with Vercel's
  [Streamdown](https://streamdown.ai) (streaming-safe GFM; styles loaded by the host app)
- **Availability gating** — the chat only appears for users with the `AI_CHAT_ACCESS`
  permission and when the backend reports a configured provider (`GET /api/ai-chat/config`)
- **AI Playground** — `/pages/playground` page with provider/model selection fed by the backend
  config endpoint
- **Keyboard shortcuts** — `Enter` to send, `Shift+Enter` for newline, `Escape` to collapse
- **Plugin system** — registered via `defineDeclarativePlugin` from `@gauzy/plugin-ui`;
  no host-app code needed beyond listing the plugin

## Usage

```typescript
import { AiChatReactUiPlugin } from '@gauzy/plugin-ai-chat-react-ui';

export const uiPluginConfig: PluginUiConfig = {
	plugins: [AiChatReactUiPlugin]
};
```

The host app must also load Streamdown's stylesheet (see `apps/gauzy/project.json`):

```json
"styles": ["node_modules/streamdown/styles.css"]
```

## How it talks to the backend

`useChat` uses a `DefaultChatTransport` pointed at `${API_BASE_URL}/api/ai-chat` with the
logged-in user's JWT in the `Authorization` header. All agent capabilities therefore run under
the user's own RBAC/tenant scope. Provider and model can be overridden per request (used by the
playground) — defaults come from the tenant's BYOK settings or server environment.

## Canvas tools (client-side)

Client tools are declared on the server without `execute` and run in the browser through two
Angular services in `@gauzy/ui-core`:

- `AgentPageBridgeService` — page registry + router navigation (`list_pages`, `open_page`)
- `AgentFormBridgeService` — DOM bridge that reads and fills the current page's forms
  (`read_page`, `fill_form`) and clicks submit (`submit_form`, approval-gated)
