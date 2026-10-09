# @gauzy/plugin-ai-provider-localai

**Local** chat + speech-to-text provider plugin for the Ever Gauzy AI chat
engine ([`@gauzy/plugin-ai-chat`](../ai-chat)) backed by
[LocalAI](https://localai.io) — a drop-in, OpenAI-compatible server that runs
open models (Llama, Qwen, Mistral, whisper, …) on your own hardware with no
cloud account and no API key.

On bootstrap it registers the `localai` provider with the chat engine's
`AiProviderRegistry`. Chat models are created lazily through the ESM-only
[`@ai-sdk/openai-compatible`](https://www.npmjs.com/package/@ai-sdk/openai-compatible)
package; dictation goes through the server's `/v1/audio/transcriptions`
(whisper backend). It needs no API key (`requiresApiKey: false`) — a tenant
credential holding only the server's base URL, or `LOCALAI_BASE_URL`, is enough.

## Run the server

```bash
# CPU, with the model gallery
docker run --rm -p 8080:8080 -v localai-models:/models localai/localai:latest

# Install a chat model and the whisper speech model from the gallery
docker exec -it <container> local-ai models install llama-3.2-3b-instruct:q4_k_m
docker exec -it <container> local-ai models install whisper-1
```

Then point Gauzy at it: **Settings → AI Providers → Add AI Provider → LocalAI**,
base URL `http://localhost:8080/v1` (prefilled), API key empty, pick the chat
model the server lists (`GET /v1/models` is fetched live), and — for dictation —
"Speech model" `whisper-1` + "Use as default voice provider".

## Environment variables

| Variable           | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `LOCALAI_BASE_URL` | Server-wide LocalAI base URL, e.g. `http://localai:8080/v1`. Setting it makes the provider configured for every tenant. |
| `LOCALAI_API_KEY`  | Optional — only when LocalAI runs with `API_KEY` set (sent as `Authorization: Bearer`). |

## Models

### Chat (curated; the live list comes from your server)

| Id                                    | Label                  |
| ------------------------------------- | ---------------------- |
| `llama-3.2-3b-instruct:q4_k_m` (default) | Llama 3.2 3B Instruct |
| `qwen2.5-7b-instruct`                 | Qwen 2.5 7B Instruct   |
| `mistral-7b-instruct-v0.3`            | Mistral 7B Instruct    |

### Speech-to-text (voice / dictation)

| Id                    | Label               |
| --------------------- | ------------------- |
| `whisper-1` (default) | Whisper (whisper-1) |

## BYOK

A tenant credential saved for the `localai` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`LOCALAI_*` environment variables.
