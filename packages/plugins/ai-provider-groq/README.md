# @gauzy/plugin-ai-provider-groq

Groq provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)). On bootstrap it registers the
`groq` provider with the chat engine's `AiProviderRegistry`. Chat models are
created lazily through the ESM-only
[`@ai-sdk/openai-compatible`](https://www.npmjs.com/package/@ai-sdk/openai-compatible)
package (Groq's API is OpenAI-shaped); **speech-to-text** (dictation) goes
through Groq's `/audio/transcriptions` (Whisper) via the shared
`transcribeViaOpenAiCompatible` helper.

## Environment variables

| Variable        | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| `GROQ_API_KEY`  | Server-wide Groq API key ([console.groq.com/keys](https://console.groq.com/keys)). |
| `GROQ_BASE_URL` | Optional custom API base URL (default `https://api.groq.com/openai/v1`). |

## Models

### Chat

| Id                                  | Label                   |
| ----------------------------------- | ----------------------- |
| `llama-3.3-70b-versatile` (default) | Llama 3.3 70B Versatile |
| `llama-3.1-8b-instant`              | Llama 3.1 8B Instant    |
| `openai/gpt-oss-120b`               | GPT-OSS 120B            |
| `openai/gpt-oss-20b`                | GPT-OSS 20B             |

The live list is fetched from `GET /openai/v1/models` when a key is saved.

### Speech-to-text (voice / dictation)

| Id                                | Label                  |
| --------------------------------- | ---------------------- |
| `whisper-large-v3-turbo` (default) | Whisper Large v3 Turbo |
| `whisper-large-v3`                | Whisper Large v3       |

Pick the model per tenant on **Settings → AI Providers → Groq → Speech model**, and tick
"Use as default voice provider" to make Groq the tenant's dictation provider.

## BYOK (bring your own key)

A tenant credential saved for the `groq` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`GROQ_*` environment variables. The environment variables act as the
server-wide fallback when no tenant credential is configured.
