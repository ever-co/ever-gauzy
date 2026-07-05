# @gauzy/plugin-ai-provider-openrouter

OpenRouter provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)). On bootstrap it registers the
`openrouter` provider with the chat engine's `AiProviderRegistry`; models are
created lazily through the ESM-only
[`@openrouter/ai-sdk-provider`](https://www.npmjs.com/package/@openrouter/ai-sdk-provider)
package. OpenRouter routes a single API key to hundreds of upstream models.

> Note: `@openrouter/ai-sdk-provider@2.x` declares a peer dependency on
> `ai@^6`, but the models it produces implement the `LanguageModelV3` spec,
> which is accepted by the `ai@7` engine used by `@gauzy/plugin-ai-chat`.
> No `ai@7`-native OpenRouter release exists yet.

## Environment variables

| Variable              | Description                                                     |
| --------------------- | --------------------------------------------------------------- |
| `OPENROUTER_API_KEY`  | Server-wide OpenRouter API key.                                 |
| `OPENROUTER_BASE_URL` | Optional custom base URL (OpenRouter-compatible endpoints).     |

## Models

| Id                                    | Label            |
| ------------------------------------- | ---------------- |
| `anthropic/claude-sonnet-5` (default) | Claude Sonnet 5  |
| `openai/gpt-5.5`                      | GPT-5.5          |
| `google/gemini-3.5-flash`             | Gemini 3.5 Flash |
| `x-ai/grok-4.3`                       | Grok 4.3         |
| `deepseek/deepseek-v4-pro`            | DeepSeek V4 Pro  |

Any other valid slug from [openrouter.ai/models](https://openrouter.ai/models)
can also be requested — the list above is only what is surfaced in the UI.

## BYOK (bring your own key)

A tenant credential saved for the `openrouter` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`OPENROUTER_*` environment variables. The environment variables act as the
server-wide fallback when no tenant credential is configured.
