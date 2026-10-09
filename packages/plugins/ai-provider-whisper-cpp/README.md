# @gauzy/plugin-ai-provider-whisper-cpp

**Local** speech-to-text provider plugin for the Ever Gauzy AI chat engine
([`@gauzy/plugin-ai-chat`](../ai-chat)) backed by
[whisper.cpp](https://github.com/ggml-org/whisper.cpp)'s `whisper-server` — a
tiny, dependency-free HTTP server that runs OpenAI Whisper (ggml) models on CPU,
Apple Silicon or CUDA. No cloud account, no API key.

On bootstrap it registers the `whisper-cpp` provider with the chat engine's
`AiProviderRegistry` as a **voice-only, local** provider: it transcribes
dictation for the AI chat but has no chat models (`chatCapable: false`). It
needs no API key (`requiresApiKey: false`) — a tenant credential holding only
the server's base URL, or `WHISPER_CPP_BASE_URL`, is enough.

Dictation calls `POST {baseUrl}/inference` as multipart (`file`,
`response_format=json`, `temperature=0`, optional `language`) and reads `text`.
The server loads **one** model at start-up (`-m`), so the "Speech model" on the
settings page is a single fixed entry, *whisper.cpp (server model)*.

## Run the server

```bash
# Build once
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
cmake -B build && cmake --build build -j --config Release
sh ./models/download-ggml-model.sh base.en        # or small / medium / large-v3-turbo

# Serve on http://localhost:8080
./build/bin/whisper-server -m models/ggml-base.en.bin --host 0.0.0.0 --port 8080 --convert
```

(`--convert` lets the server accept the browser's WebM/Opus and MP4 recordings by
converting them with ffmpeg; without it whisper-server only accepts 16 kHz WAV.)

Or with Docker: `docker run --rm -p 8080:8080 -v ./models:/models ghcr.io/ggml-org/whisper.cpp:main
./build/bin/whisper-server -m /models/ggml-base.en.bin --host 0.0.0.0 --port 8080 --convert`.

Then point Gauzy at it: **Settings → AI Providers → Add AI Voice Provider →
whisper.cpp**, base URL `http://localhost:8080` (prefilled), leave the API key
empty, tick "Use as default voice provider".

## Environment variables

| Variable               | Description                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `WHISPER_CPP_BASE_URL` | Server-wide whisper-server base URL, e.g. `http://whisper:8080`. Setting it makes the provider configured for every tenant. |
| `WHISPER_CPP_API_KEY`  | Optional — only if you put the server behind an authenticating proxy (`Authorization: Bearer`). |

## BYOK

A tenant credential saved for the `whisper-cpp` provider via the AI chat
credentials API (`/api/ai-chat/credentials`) always takes precedence over the
`WHISPER_CPP_*` environment variables.
