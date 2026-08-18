# @gauzy/plugin-ai-provider-mistral

Mistral AI provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)). On bootstrap it registers the
`mistral` provider with the chat engine's `AiProviderRegistry`. Chat models are
created lazily through the ESM-only
[`@ai-sdk/openai-compatible`](https://www.npmjs.com/package/@ai-sdk/openai-compatible)
package (Mistral's chat API is OpenAI-shaped); **speech-to-text** (dictation)
goes through Mistral's `/audio/transcriptions` (Voxtral) via the shared
`transcribeViaOpenAiCompatible` helper.

## Environment variables

| Variable           | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `MISTRAL_API_KEY`  | Server-wide Mistral API key ([console.mistral.ai/api-keys](https://console.mistral.ai/api-keys)). |
| `MISTRAL_BASE_URL` | Optional custom API base URL (default `https://api.mistral.ai/v1`).   |

## Models

### Chat

| Id                                | Label          |
| --------------------------------- | -------------- |
| `mistral-medium-latest` (default) | Mistral Medium |
| `mistral-small-latest`            | Mistral Small  |
| `mistral-large-latest`            | Mistral Large  |

The live list is fetched from `GET /v1/models` when a key is saved (models
reporting `function_calling: false` are hidden — the agent calls tools every turn).

### Speech-to-text (voice / dictation)

| Id                              | Label         |
| ------------------------------- | ------------- |
| `voxtral-mini-latest` (default) | Voxtral Mini  |
| `voxtral-small-latest`          | Voxtral Small |

Pick the model per tenant on **Settings → AI Providers → Mistral → Speech model**, and tick
"Use as default voice provider" to make Mistral the tenant's dictation provider.

## BYOK (bring your own key)

A tenant credential saved for the `mistral` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`MISTRAL_*` environment variables. The environment variables act as the
server-wide fallback when no tenant credential is configured.
