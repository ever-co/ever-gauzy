# @gauzy/plugin-ai-provider-openai-compatible

Generic **OpenAI-compatible endpoint** provider plugin for the Ever Gauzy AI
chat engine ([`@gauzy/plugin-ai-chat`](../ai-chat)): point it at any server or
gateway that speaks the OpenAI REST API — [vLLM](https://docs.vllm.ai),
[LM Studio](https://lmstudio.ai), [Ollama](https://ollama.com) (`/v1`),
[LiteLLM](https://docs.litellm.ai), text-generation-webui, llama.cpp's
`llama-server`, a corporate gateway, … — for chat and (where the server
implements `/audio/transcriptions`) for dictation.

On bootstrap it registers the `openai-compatible` provider with the chat
engine's `AiProviderRegistry`. Chat models are created lazily through the
ESM-only [`@ai-sdk/openai-compatible`](https://www.npmjs.com/package/@ai-sdk/openai-compatible)
package. There is **no default host**: the tenant (or `OPENAI_COMPATIBLE_BASE_URL`)
must supply the base URL (`requiresBaseUrl`); an API key is optional
(`requiresApiKey: false`) because most local servers run without one.

Examples of base URLs: `http://localhost:11434/v1` (Ollama), `http://localhost:1234/v1`
(LM Studio), `http://localhost:8000/v1` (vLLM), `http://localhost:4000` (LiteLLM proxy).

## Environment variables

| Variable                     | Description                                                                 |
| ---------------------------- | --------------------------------------------------------------------------- |
| `OPENAI_COMPATIBLE_BASE_URL` | Server-wide base URL of the endpoint (required for the env route).           |
| `OPENAI_COMPATIBLE_API_KEY`  | Optional API key (`Authorization: Bearer`).                                  |

## Models

### Chat

No curated list — the picker shows whatever your server returns from
`GET {baseUrl}/models`; if it implements no `/models`, choose "Custom model…" and
type the id (e.g. `llama3.1:8b`, `Qwen/Qwen2.5-7B-Instruct`). Pick a default
model on the settings page — this provider has none of its own.

### Speech-to-text (voice / dictation)

| Id                    | Label               |
| --------------------- | ------------------- |
| `whisper-1` (default) | Whisper (whisper-1) |

Only works when the server implements `POST /audio/transcriptions`; otherwise
the request fails as a provider error and dictation falls through to the next
capable provider.

## BYOK

A tenant credential saved for the `openai-compatible` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`OPENAI_COMPATIBLE_*` environment variables.
