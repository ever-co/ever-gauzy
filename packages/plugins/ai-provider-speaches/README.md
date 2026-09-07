# @gauzy/plugin-ai-provider-speaches

**Local** speech-to-text provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)) backed by
[Speaches](https://speaches.ai) (formerly *faster-whisper-server*) — an
OpenAI-compatible server that runs Whisper models on your own hardware
(CPU or GPU) with no cloud account and no API key.

On bootstrap it registers the `speaches` provider with the chat engine's
`AiProviderRegistry` as a **voice-only, local** provider: it transcribes
dictation for the AI chat (`POST {baseUrl}/audio/transcriptions`) but has no
chat models (`chatCapable: false`). It needs no API key (`requiresApiKey:
false`) — a tenant credential holding only the server's base URL, or the
`SPEACHES_BASE_URL` environment variable, is enough.

## Run the server

```bash
# CPU
docker run --rm -p 8000:8000 -v hf-hub-cache:/home/ubuntu/.cache/huggingface/hub \
  ghcr.io/speaches-ai/speaches:latest-cpu

# NVIDIA GPU (CUDA)
docker run --rm --gpus=all -p 8000:8000 -v hf-hub-cache:/home/ubuntu/.cache/huggingface/hub \
  ghcr.io/speaches-ai/speaches:latest-cuda
```

Models are pulled from the Hugging Face Hub on first use (or pre-pull:
`curl -X POST http://localhost:8000/v1/models/Systran/faster-whisper-small`).
Then point Gauzy at it: **Settings → AI Providers → Add AI Voice Provider →
Speaches**, base URL `http://localhost:8000/v1` (prefilled), leave the API key
empty, pick a speech model and tick "Use as default voice provider".

## Environment variables

| Variable            | Description                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `SPEACHES_BASE_URL` | Server-wide Speaches base URL, e.g. `http://speaches:8000/v1`. Setting it makes the provider configured for every tenant. |
| `SPEACHES_API_KEY`  | Optional — only if you put the server behind an authenticating proxy (`Authorization: Bearer`). |

## Speech-to-text models

| Id                                          | Label                         |
| ------------------------------------------- | ----------------------------- |
| `Systran/faster-whisper-small` (default)    | Faster Whisper Small          |
| `Systran/faster-distil-whisper-large-v3`    | Distil-Whisper Large v3       |
| `deepdml/faster-whisper-large-v3-turbo-ct2` | Faster Whisper Large v3 Turbo |

Any other CTranslate2 Whisper model the server can load works too — pick
"Custom model…" and type its Hugging Face id. `listModels` reads the server's
`GET /v1/models`.

## BYOK

A tenant credential saved for the `speaches` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`SPEACHES_*` environment variables.
