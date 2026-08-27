# @gauzy/plugin-ai-provider-deepgram

Deepgram **speech-to-text** provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)). On bootstrap it registers the
`deepgram` provider with the chat engine's `AiProviderRegistry` as a
**voice-only** provider: it transcribes dictation for the AI chat but has no
chat models (`chatCapable: false` — it can be the tenant's default voice
provider and is never selectable for chat).

Dictation calls `POST https://api.deepgram.com/v1/listen?model=<model>&smart_format=true`
with the raw recording as the body (`Content-Type` = the browser's container)
and `Authorization: Token <key>`; the transcript is read from
`results.channels[0].alternatives[0].transcript`.

## Environment variables

| Variable            | Description                                                          |
| ------------------- | -------------------------------------------------------------------- |
| `DEEPGRAM_API_KEY`  | Server-wide Deepgram API key ([console.deepgram.com](https://console.deepgram.com/)). |
| `DEEPGRAM_BASE_URL` | Optional custom API base URL (default `https://api.deepgram.com/v1`). |

## Speech-to-text models

| Id                 | Label  |
| ------------------ | ------ |
| `nova-3` (default) | Nova-3 |
| `nova-2`           | Nova-2 |

Pick the model per tenant on **Settings → AI Providers → Deepgram → Speech model**, and tick
"Use as default voice provider" to make Deepgram the tenant's dictation provider.

## BYOK (bring your own key)

A tenant credential saved for the `deepgram` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`DEEPGRAM_*` environment variables. The environment variables act as the
server-wide fallback when no tenant credential is configured.
