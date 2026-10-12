# @gauzy/plugin-ai-provider-elevenlabs

ElevenLabs **speech-to-text** (Scribe) provider plugin for the Ever Gauzy AI
chat engine ([`@gauzy/plugin-ai-chat`](../ai-chat)). On bootstrap it registers
the `elevenlabs` provider with the chat engine's `AiProviderRegistry` as a
**voice-only** provider: it transcribes dictation for the AI chat but has no
chat models (`chatCapable: false` — it can be the tenant's default voice
provider and is never selectable for chat).

Dictation calls `POST https://api.elevenlabs.io/v1/speech-to-text` as
multipart (`file` + `model_id`, optional `language_code`) with the
`xi-api-key` header; the transcript is read from `text`.

## Environment variables

| Variable              | Description                                                                 |
| --------------------- | --------------------------------------------------------------------------- |
| `ELEVENLABS_API_KEY`  | Server-wide ElevenLabs API key ([elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)). |
| `ELEVENLABS_BASE_URL` | Optional custom API base URL (default `https://api.elevenlabs.io/v1`).      |

## Speech-to-text models

| Id                       | Label                    |
| ------------------------ | ------------------------ |
| `scribe_v1` (default)    | Scribe v1                |
| `scribe_v1_experimental` | Scribe v1 (experimental) |

Pick the model per tenant on **Settings → AI Providers → ElevenLabs → Speech model**, and
tick "Use as default voice provider" to make ElevenLabs the tenant's dictation provider.

## BYOK (bring your own key)

A tenant credential saved for the `elevenlabs` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`ELEVENLABS_*` environment variables. The environment variables act as the
server-wide fallback when no tenant credential is configured.
