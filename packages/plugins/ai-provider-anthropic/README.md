# @gauzy/plugin-ai-provider-anthropic

Anthropic (Claude) provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)). On bootstrap it registers the
`anthropic` provider with the chat engine's `AiProviderRegistry`; models are
created lazily through the ESM-only [`@ai-sdk/anthropic`](https://www.npmjs.com/package/@ai-sdk/anthropic)
package (Vercel AI SDK).

## Environment variables

| Variable             | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | Server-wide Anthropic API key.                                       |
| `ANTHROPIC_BASE_URL` | Optional custom API base URL (proxy / gateway endpoints).            |

## Models

| Id                          | Label            |
| --------------------------- | ---------------- |
| `claude-sonnet-5` (default) | Claude Sonnet 5  |
| `claude-opus-5`             | Claude Opus 5    |
| `claude-haiku-4-5-20251001` | Claude Haiku 4.5 |

## BYOK (bring your own key)

A tenant credential saved for the `anthropic` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`ANTHROPIC_*` environment variables. The environment variables act as the
server-wide fallback when no tenant credential is configured.
