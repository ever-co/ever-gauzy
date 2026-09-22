# @gauzy/plugin-ai-provider-openai

OpenAI (GPT) provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)). On bootstrap it registers the
`openai` provider with the chat engine's `AiProviderRegistry`; models are
created lazily through the ESM-only [`@ai-sdk/openai`](https://www.npmjs.com/package/@ai-sdk/openai)
package (Vercel AI SDK, Responses API).

## Environment variables

| Variable          | Description                                                        |
| ----------------- | ------------------------------------------------------------------ |
| `OPENAI_API_KEY`  | Server-wide OpenAI API key.                                        |
| `OPENAI_BASE_URL` | Optional custom API base URL (proxy / Azure-compatible endpoints). |

## Models

| Id                  | Label        |
| ------------------- | ------------ |
| `gpt-5.5` (default) | GPT-5.5      |
| `gpt-5.4`           | GPT-5.4      |
| `gpt-5.4-mini`      | GPT-5.4 Mini |
| `gpt-5.4-nano`      | GPT-5.4 Nano |

## BYOK (bring your own key)

A tenant credential saved for the `openai` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`OPENAI_*` environment variables. The environment variables act as the
server-wide fallback when no tenant credential is configured.
