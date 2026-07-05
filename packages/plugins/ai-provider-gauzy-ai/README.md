# @gauzy/plugin-ai-provider-gauzy-ai

Gauzy AI provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)) — currently a **placeholder**.

On bootstrap it registers the `gauzy-ai` provider with the chat engine's
`AiProviderRegistry` so the provider appears in the registry and the UI, but
**chat is not routed through Gauzy AI yet**: `createModel` throws
`Chat via Gauzy AI is not implemented yet — configure another provider.`
and the provider exposes no models. Use one of the direct provider plugins
(`@gauzy/plugin-ai-provider-anthropic`, `-openai`, `-openrouter`,
`-vercel-gateway`) in the meantime.

## Environment variables

| Variable            | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `GAUZY_AI_API_KEY`  | Server-wide Gauzy AI API key (reserved for future use).  |
| `GAUZY_AI_BASE_URL` | Optional custom Gauzy AI API base URL.                   |

## Planned design

When the Gauzy AI integration
([`packages/plugins/integration-ai`](../integration-ai)) is enabled for a
tenant, chat requests for the `gauzy-ai` provider will be **proxied to the
Gauzy AI API**, which manages provider API keys, model selection and routing
server-side — so tenants get chat without configuring any upstream provider
key. BYOK (per-tenant keys via `/api/ai-chat/credentials`) remains the way to
use the direct providers, and continues to take precedence over server
environment variables for those providers.
