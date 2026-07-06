# @gauzy/plugin-ai-chat

Backend engine for the **embedded AI agent chat** in the Ever® Gauzy™ platform, powered by the
[Vercel AI SDK](https://ai-sdk.dev) (v7).

The matching frontend is [`@gauzy/plugin-ai-chat-react-ui`](../ai-chat-react-ui) — a collapsible
chat sidebar rendered between the navigation menu and the page content
(`Menu | Chat | Canvas`), where the agent can also open any platform page and fill forms.

## Endpoints

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/ai-chat` | POST | `AI_CHAT_ACCESS` | One chat turn. Accepts `{ messages: UIMessage[], providerId?, modelId? }`, streams back a Vercel AI SDK **UI message stream** (SSE) with text, tool calls, tool results and approval requests. |
| `/api/ai-chat/config` | GET | `AI_CHAT_ACCESS` | Providers/models/config status for the current tenant (never returns secrets). |
| `/api/ai-chat/credentials` | CRUD | `AI_CHAT_SETTINGS` | Per-tenant BYOK provider credentials (API keys stored encrypted; reads return masked keys). |

## Architecture

```
useChat (React, @ai-sdk/react v4)
   │  POST /api/ai-chat  (JWT bearer of the logged-in user)
   ▼
AiChatController ──▶ AiChatService.streamChat()
   │  streamText() tool loop (ai@7), stopWhen isStepCount(12)
   ├─ server tools (tools/gauzy-tools.ts) ──▶ Gauzy REST API
   │        with the USER'S OWN Authorization header →
   │        existing guards enforce RBAC + tenant isolation
   ├─ client tools (tools/client-tools.ts) — declared WITHOUT execute:
   │        forwarded to the browser (open_page / read_page /
   │        fill_form / submit_form) and executed by the Angular app
   ├─ optional MCP tools (tools/mcp-tools.ts) via @ai-sdk/mcp
   └─ provider/model resolved through AiProviderRegistry
            (BYOK credential → env key), model created by the
            provider plugin (@gauzy/plugin-ai-provider-*)
```

### Security model

- **The agent is the user.** Every server tool call carries the requesting user's own JWT to the
  Gauzy REST API — the same guards, role permissions and tenant scoping apply as for any other
  client. The agent cannot read or mutate anything the user could not.
- **Mutations need human approval.** Tools that change data (`create_task`, `start_timer`,
  `stop_timer`, `submit_form`) are wrapped with the AI SDK's tool-approval flow
  (`toolApproval: 'user-approval'`): the UI renders Approve / Reject buttons and the tool only
  runs after an explicit approval.
- **Endpoint gating.** `POST /api/ai-chat` requires the `AI_CHAT_ACCESS` permission; credentials
  management requires `AI_CHAT_SETTINGS`.
- **BYOK keys** are encrypted at rest and only ever returned masked.

### Verified permission ceiling (audit 2026-07-05)

The guarantee "the agent can only ever do what the requesting user can do" was verified live
against a running stack:

| Check | Result |
|---|---|
| User without `AI_CHAT_ACCESS` calls `POST /api/ai-chat` / `GET /config` | **403** |
| User without `AI_CHAT_SETTINGS` calls `/api/ai-chat/credentials` | **403** |
| Employee (no `ORG_INCOMES_VIEW`) calls `GET /api/income` directly | **403** |
| The same employee asks the agent for income records (`get_incomes` tool) | tool receives the **same 403** and the agent reports it honestly |
| User A's conversation fetched/deleted by user B (same tenant) | **404** (read and delete) |
| Conversation ids | client-supplied ids honored only when globally unused (no overwrite of another user's row) |

Why this holds by construction: the user's own JWT (plus `Tenant-Id`/`Organization-Id`) is the
ONLY credential in the server-tool path — there is no service account; client/canvas tools run
in the user's own browser session where route guards and server-side validation still apply;
history queries are explicitly scoped by `(tenantId, userId)`; provider API keys can only reach
LLM endpoints, never the Gauzy API; MCP tools are disabled by default (see the security note).

### Provider plugins

Providers are NOT part of this plugin. Each provider ships as its own backend plugin implementing
`IAiChatProviderDefinition` and registering with `AiProviderRegistry` on bootstrap:

- `@gauzy/plugin-ai-provider-anthropic` — default model `claude-sonnet-5`
- `@gauzy/plugin-ai-provider-openai`
- `@gauzy/plugin-ai-provider-openrouter`
- `@gauzy/plugin-ai-provider-vercel-gateway`
- `@gauzy/plugin-ai-provider-gauzy-ai` — registered, but chat is **not** routed through
  Gauzy AI yet (see that plugin's README for the planned design)

Credential resolution order per provider: **tenant BYOK** (Settings → AI, stored via
`/api/ai-chat/credentials`) → **server environment variable** → not configured.

### Environment variables

See the `AI CHAT` section of the repo's `.env.sample`:
`GAUZY_AI_CHAT_ENABLED`, `GAUZY_AI_CHAT_DEFAULT_PROVIDER`, `GAUZY_AI_CHAT_DEFAULT_MODEL`,
provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`,
`AI_GATEWAY_API_KEY`) and optional `*_BASE_URL` overrides, `GAUZY_AI_CHAT_MCP_URL`,
`GAUZY_AI_CHAT_SELF_API_URL`.

### MCP integration (optional)

Setting `GAUZY_AI_CHAT_MCP_URL` attaches the tools of a running Gauzy MCP server to the agent via
the stable `@ai-sdk/mcp` client. A fresh MCP client is created per chat request and the user's
`Authorization` header is forwarded.

> **Security note:** only enable this against an MCP server that validates and **uses the
> per-request bearer token** for its own Gauzy API calls. The bundled `@gauzy/mcp-server`
> historically authenticates with a single service login (`AuthManager` singleton); pointing this
> at such an instance would execute tools with the *server's* identity instead of the requesting
> user's — a permission bypass. Until the MCP server supports per-session user tokens end-to-end,
> keep this unset in multi-user deployments; the built-in curated tools cover the same API surface
> safely.

### ESM interop

The AI SDK v7 family is ESM-only while the Gauzy API compiles to CommonJS. `src/lib/esm-loader.ts`
loads it via `require(esm)` (native on Node ≥ 22.12) with a dynamic-`import()` fallback. Provider
plugins reuse the same helper (`importEsm`).

## License

AGPL-3.0 — see the repository license.
