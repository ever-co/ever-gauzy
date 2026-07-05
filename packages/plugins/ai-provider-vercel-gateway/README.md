# @gauzy/plugin-ai-provider-vercel-gateway

Vercel AI Gateway provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)). On bootstrap it registers the
`vercel-gateway` provider with the chat engine's `AiProviderRegistry`; models
are created lazily through the ESM-only
[`@ai-sdk/gateway`](https://www.npmjs.com/package/@ai-sdk/gateway) package.
The gateway routes a single Vercel API key to models from many upstream
providers with built-in failover, budgets and usage analytics.

## Environment variables

| Variable              | Description                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY`  | Server-wide Vercel AI Gateway API key (or Vercel OIDC/access token).      |
| `AI_GATEWAY_BASE_URL` | Optional custom gateway base URL (defaults to Vercel's hosted gateway).   |

## Models

| Id                                    | Label            |
| ------------------------------------- | ---------------- |
| `anthropic/claude-sonnet-5` (default) | Claude Sonnet 5  |
| `anthropic/claude-opus-4.8`           | Claude Opus 4.8  |
| `openai/gpt-5.5`                      | GPT-5.5          |
| `google/gemini-3.5-flash`             | Gemini 3.5 Flash |

Any other valid slug from the [gateway model catalog](https://vercel.com/ai-gateway/models)
can also be requested — the list above is only what is surfaced in the UI.

## BYOK (bring your own key)

A tenant credential saved for the `vercel-gateway` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`AI_GATEWAY_*` environment variables. The environment variables act as the
server-wide fallback when no tenant credential is configured.
