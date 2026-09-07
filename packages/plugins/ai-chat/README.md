# @gauzy/plugin-ai-chat

Backend engine for the **embedded AI agent chat** in the Ever® Gauzy™ platform, powered by the
[Vercel AI SDK](https://ai-sdk.dev) (v7).

The matching frontend is [`@gauzy/plugin-ai-chat-react-ui`](../ai-chat-react-ui) — a collapsible
chat sidebar rendered between the navigation menu and the page content
(`Menu | Chat | Canvas`), where the agent can also open any platform page and fill forms.

## Endpoints

| Endpoint | Method | Permission | Description |
|---|---|---|---|
| `/api/ai-chat` | POST | `AI_CHAT_ACCESS` | One chat turn. Accepts `{ messages: UIMessage[], providerId?, modelId? }`, streams back a Vercel AI SDK **UI message stream** (SSE) with text, tool calls, tool results and approval requests. |
| `/api/ai-chat/config` | GET | `AI_CHAT_ACCESS` or `AI_CHAT_SETTINGS` | Providers/models/config status for the current tenant (never returns secrets). When `enabled` is `false`, `disabledReason` says why (`globally-disabled` = `GAUZY_AI_CHAT_ENABLED=false`, `no-providers` = no provider has usable credentials) so the UI can explain it instead of silently hiding the chat. |
| `/api/ai-chat/credentials` | CRUD | `AI_CHAT_SETTINGS` | Per-tenant BYOK provider credentials (API keys stored encrypted; reads return masked keys). Rows also carry the voice preferences `isVoiceDefault` / `speechModel`. |
| `/api/ai-chat/transcribe` | POST | `AI_CHAT_ACCESS` | Dictation: multipart `file` (audio as recorded by the browser, ≤ 25 MB) → `{ text }`. On failure a **503 with a structured body** `{ message, code, settingsPath }` where `code` ∈ `AI_SPEECH_NOT_CONFIGURED` / `AI_SPEECH_KEY_REJECTED` / `AI_SPEECH_FAILED` and `settingsPath` = `/pages/settings/ai` (see *Voice / speech-to-text providers*). |
| `/api/ai-chat/providers/:id/models` | GET | `AI_CHAT_ACCESS` or `AI_CHAT_SETTINGS` | Live model catalogue of one provider for the settings picker (fails open to the curated list). |

## Architecture

```
useChat (React, @ai-sdk/react v4)
   │  POST /api/ai-chat  (JWT bearer of the logged-in user)
   ▼
AiChatController ──▶ AiChatService.streamChat()
   │  streamText() tool loop (ai@7), stopWhen isStepCount(12)
   ├─ server tools (tools/gauzy-tools.ts) ──▶ Gauzy REST API
   │        with the USER'S OWN Authorization header →
   │        existing guards enforce RBAC + tenant isolation
   ├─ client tools (tools/client-tools.ts) — declared WITHOUT execute:
   │        forwarded to the browser (open_page / read_page /
   │        fill_form / submit_form) and executed by the Angular app
   ├─ optional MCP tools (tools/mcp-tools.ts) via @ai-sdk/mcp
   └─ provider/model resolved through AiProviderRegistry
            (BYOK credential → env key), model created by the
            provider plugin (@gauzy/plugin-ai-provider-*)
```

### Security model

- **The agent is the user.** Every server tool call carries the requesting user's own JWT to the
  Gauzy REST API — the same guards, role permissions and tenant scoping apply as for any other
  client. The agent cannot read or mutate anything the user could not.
- **Mutations need human approval.** Tools that change data (`create_task`, `start_timer`,
  `stop_timer`, `submit_form`) are wrapped with the AI SDK's tool-approval flow
  (`toolApproval: 'user-approval'`): the UI renders Approve / Reject buttons and the tool only
  runs after an explicit approval.
- **Endpoint gating.** `POST /api/ai-chat` requires the `AI_CHAT_ACCESS` permission; credentials
  management requires `AI_CHAT_SETTINGS`.
- **BYOK keys** are encrypted at rest and only ever returned masked.

### Verified permission ceiling (audit 2026-07-05)

The guarantee "the agent can only ever do what the requesting user can do" was verified live
against a running stack:

| Check | Result |
|---|---|
| User without `AI_CHAT_ACCESS` calls `POST /api/ai-chat` / `GET /config` | **403** |
| User without `AI_CHAT_SETTINGS` calls `/api/ai-chat/credentials` | **403** |
| Employee (no `ORG_INCOMES_VIEW`) calls `GET /api/income` directly | **403** |
| The same employee asks the agent for income records (`get_incomes` tool) | tool receives the **same 403** and the agent reports it honestly |
| User A's conversation fetched/deleted by user B (same tenant) | **404** (read and delete) |
| Conversation ids | client-supplied ids honored only when globally unused (no overwrite of another user's row) |

Why this holds by construction: the user's own JWT (plus `Tenant-Id`/`Organization-Id`) is the
ONLY credential in the server-tool path — there is no service account; client/canvas tools run
in the user's own browser session where route guards and server-side validation still apply;
history queries are explicitly scoped by `(tenantId, userId)`; provider API keys can only reach
LLM endpoints, never the Gauzy API; MCP tools are disabled by default (see the security note).

### Provider plugins

Providers are NOT part of this plugin. Each provider ships as its own backend plugin implementing
`IAiChatProviderDefinition` and registering with `AiProviderRegistry` on bootstrap:

| Plugin | id | order | Chat | Speech-to-text | Local | Env vars |
|---|---|---|---|---|---|---|
| `@gauzy/plugin-ai-provider-gauzy-ai` | `gauzy-ai` | 10 | placeholder (`chatCapable: false`) | — | — | `GAUZY_AI_BASE_URL` |
| `@gauzy/plugin-ai-provider-openrouter` | `openrouter` | 20 | ✓ (+ Connect / PKCE, free tier) | — | — | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `OPENROUTER_PLATFORM_API_KEY` |
| `@gauzy/plugin-ai-provider-vercel-gateway` | `vercel-gateway` | 30 | ✓ | — | — | `AI_GATEWAY_API_KEY`, `AI_GATEWAY_BASE_URL` |
| `@gauzy/plugin-ai-provider-anthropic` | `anthropic` | 40 | ✓ (default model `claude-sonnet-5`) | — | — | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` |
| `@gauzy/plugin-ai-provider-openai` | `openai` | 50 | ✓ | ✓ `gpt-4o-mini-transcribe` (default), `gpt-4o-transcribe`, `whisper-1` | — | `OPENAI_API_KEY`, `OPENAI_BASE_URL` |
| `@gauzy/plugin-ai-provider-gemini` | `gemini` | 60 | ✓ | — | — | `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_BASE_URL` |
| `@gauzy/plugin-ai-provider-grok` | `grok` | 70 | ✓ | — | — | `XAI_API_KEY`, `GROK_API_KEY`, `XAI_BASE_URL` |
| `@gauzy/plugin-ai-provider-groq` | `groq` | 80 | ✓ (OpenAI-compatible) | ✓ `whisper-large-v3-turbo` (default), `whisper-large-v3` | — | `GROQ_API_KEY`, `GROQ_BASE_URL` |
| `@gauzy/plugin-ai-provider-mistral` | `mistral` | 90 | ✓ (OpenAI-compatible) | ✓ `voxtral-mini-latest` (default), `voxtral-small-latest` | — | `MISTRAL_API_KEY`, `MISTRAL_BASE_URL` |
| `@gauzy/plugin-ai-provider-speaches` | `speaches` | 100 | — | ✓ faster-whisper models (`Systran/faster-whisper-small` default) | ✓ no key | `SPEACHES_BASE_URL`, `SPEACHES_API_KEY` |
| `@gauzy/plugin-ai-provider-localai` | `localai` | 101 | ✓ (OpenAI-compatible) | ✓ `whisper-1` | ✓ no key | `LOCALAI_BASE_URL`, `LOCALAI_API_KEY` |
| `@gauzy/plugin-ai-provider-whisper-cpp` | `whisper-cpp` | 102 | — | ✓ server model (`/inference`) | ✓ no key | `WHISPER_CPP_BASE_URL`, `WHISPER_CPP_API_KEY` |
| `@gauzy/plugin-ai-provider-openai-compatible` | `openai-compatible` | 103 | ✓ (tenant base URL required) | ✓ `whisper-1` (if the server implements it) | ✓ no key | `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY` |
| `@gauzy/plugin-ai-provider-deepgram` | `deepgram` | 110 | — | ✓ `nova-3` (default), `nova-2` | — | `DEEPGRAM_API_KEY`, `DEEPGRAM_BASE_URL` |
| `@gauzy/plugin-ai-provider-elevenlabs` | `elevenlabs` | 120 | — | ✓ `scribe_v1` (default) | — | `ELEVENLABS_API_KEY`, `ELEVENLABS_BASE_URL` |

Credential resolution order per provider: **tenant BYOK** (Settings → AI Providers, stored via
`/api/ai-chat/credentials`) → **server environment variable** → (OpenRouter only) **platform key**
→ not configured. Providers marked *no key* (`requiresApiKey: false`) are configured by a **base
URL alone** — a tenant credential holding just the URL, or the `*_BASE_URL` variable.

### Voice / speech-to-text providers (dictation)

The chat's microphone button posts the recording to `POST /api/ai-chat/transcribe`. Speech
capability is a property of the provider definition — `transcribe?(audio, mimeType, credentials,
{ model?, language? })` plus a `speech: { models, defaultModel }` catalogue — and is exposed to the
UI as `speechCapable` / `speechModels` / `defaultSpeechModel` on `GET /config`, together with
`speechConfigured` (can this tenant dictate right now?) and `defaultVoiceProvider`.

**How the provider is chosen** (mirrors ever-works' operator-pinned transcription provider with
fallback to the first capable one):

1. the tenant's **voice default** — the credential row flagged `isVoiceDefault` (Settings → AI
   Providers → *Use as default voice provider (dictation)*), if that provider can transcribe and its
   credentials resolve;
2. otherwise every other speech-capable provider **in `order`** (see the table above), using the
   first one that has credentials; a failure falls through to the next one.

The speech **model** is the tenant's `speechModel` on that provider's credential row (Settings →
*Speech model*), else the provider's `speech.defaultModel`. Dictation is independent of the chat
provider: a tenant can chat through Anthropic and dictate through OpenAI, Groq or a local whisper
server. Voice-only providers (Deepgram, ElevenLabs, Speaches, whisper.cpp) are `chatCapable: false`
— they show in the catalogue with a *Speech-to-text* chip, can be the voice default, and are never
selectable for chat.

**Errors** are a 503 with an object body so the chat panel can be actionable:

```json
{ "message": "Dictation needs a voice provider. Add one (…) on the AI Providers settings page.",
  "code": "AI_SPEECH_NOT_CONFIGURED", "settingsPath": "/pages/settings/ai" }
```

`code` is `AI_SPEECH_NOT_CONFIGURED` (nothing capable has credentials), `AI_SPEECH_KEY_REJECTED`
(a provider answered 401/403 — the classification comes from the typed `SpeechProviderError`
thrown by the shared helper, never from regex over prose) or `AI_SPEECH_FAILED`. The React chat
input renders a translated message per code with an *Open AI Providers* link for users holding
`AI_CHAT_SETTINGS`, and an "ask an administrator" variant otherwise. `message` stays human-readable
for old clients.

**Implementing speech in a provider plugin** — use the shared helper exported by this package:

```ts
import { transcribeViaOpenAiCompatible, transcribeMultipart, speechRequest, SpeechProviderError } from '@gauzy/plugin-ai-chat';

transcribe: (audio, mimeType, credentials, options) =>
	transcribeViaOpenAiCompatible({
		baseUrl: credentials.baseUrl || 'https://api.example.com/v1', // POST {baseUrl}/audio/transcriptions
		apiKey: credentials.apiKey,                                     // omitted header when empty (local servers)
		audio, mimeType,
		model: options?.model || 'whisper-1',
		language: options?.language,
		providerLabel: 'Example', providerId: 'example'
	}),
speech: { models: [{ id: 'whisper-1', label: 'Whisper', providerId: 'example' }], defaultModel: 'whisper-1' }
```

`transcribeMultipart` (custom field names / headers / body parser — ElevenLabs, whisper.cpp) and
`speechRequest` (raw body — Deepgram) sit underneath it. All three classify by HTTP status
(401/403 → `key-rejected`, 429 → `rate-limited`, 400/415/422 → `audio-rejected`, other → `http`,
no answer → `network`), read the error body **bounded** and **redacted** of the key in use, never
relay it on a credential failure, and never relay `statusText`.

**Local / self-hosted voice servers** (no API key; set the base URL in Settings → AI Providers or
in the environment):

```bash
# Speaches (faster-whisper-server) — OpenAI-compatible, CPU image; models pulled on demand
docker run --rm -p 8000:8000 -v hf-hub-cache:/home/ubuntu/.cache/huggingface/hub ghcr.io/speaches-ai/speaches:latest-cpu
# → base URL http://localhost:8000/v1   (SPEACHES_BASE_URL)

# LocalAI — chat + whisper (install the whisper-1 gallery model)
docker run --rm -p 8080:8080 -v localai-models:/models localai/localai:latest
docker exec -it <container> local-ai models install whisper-1
# → base URL http://localhost:8080/v1   (LOCALAI_BASE_URL)

# whisper.cpp whisper-server — one ggml model, tiny footprint (needs --convert for browser WebM/MP4)
./build/bin/whisper-server -m models/ggml-base.en.bin --host 0.0.0.0 --port 8080 --convert
# → base URL http://localhost:8080      (WHISPER_CPP_BASE_URL)

# Any OpenAI-compatible endpoint (Ollama /v1, LM Studio, vLLM, LiteLLM …)
# → base URL e.g. http://localhost:11434/v1   (OPENAI_COMPATIBLE_BASE_URL)
```

Local providers are **not** auto-configured from their conventional default address — the tenant
or operator has to point at a running server, or every install would advertise dictation through a
server that is not there.

### Environment variables

See the `AI CHAT` and `AI VOICE` sections of the repo's `.env.sample`:
`GAUZY_AI_CHAT_ENABLED`, `GAUZY_AI_CHAT_DEFAULT_PROVIDER`, `GAUZY_AI_CHAT_DEFAULT_MODEL`,
provider keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`,
`AI_GATEWAY_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY`, `MISTRAL_API_KEY`,
`DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`) and optional `*_BASE_URL` overrides, the local-server
base URLs (`SPEACHES_BASE_URL`, `LOCALAI_BASE_URL`, `WHISPER_CPP_BASE_URL`,
`OPENAI_COMPATIBLE_BASE_URL`), `GAUZY_AI_CHAT_MCP_URL`, `GAUZY_AI_CHAT_SELF_API_URL`.

### MCP integration (optional)

Setting `GAUZY_AI_CHAT_MCP_URL` attaches the tools of a running Gauzy MCP server to the agent via
the stable `@ai-sdk/mcp` client. A fresh MCP client is created per chat request and the user's
`Authorization` header is forwarded.

> **Security note:** only enable this against an MCP server that validates and **uses the
> per-request bearer token** for its own Gauzy API calls. The bundled `@gauzy/mcp-server`
> historically authenticates with a single service login (`AuthManager` singleton); pointing this
> at such an instance would execute tools with the *server's* identity instead of the requesting
> user's — a permission bypass. Until the MCP server supports per-session user tokens end-to-end,
> keep this unset in multi-user deployments; the built-in curated tools cover the same API surface
> safely.

### ESM interop

The AI SDK v7 family is ESM-only while the Gauzy API compiles to CommonJS. `src/lib/esm-loader.ts`
loads it via `require(esm)` (native on Node ≥ 22.12) with a dynamic-`import()` fallback. Provider
plugins reuse the same helper (`importEsm`).

## License

AGPL-3.0 — see the repository license.
