# @gauzy/plugin-ai-provider-gemini

Ever Gauzy AI Chat provider plugin: registers **Gemini** models with the
`@gauzy/plugin-ai-chat` provider registry via `@ai-sdk/google`.

## Configuration

| Env var | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-wide API key (tenants can instead set a BYOK key in Settings -> AI) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Accepted alias for the server-wide API key |
| `GEMINI_BASE_URL` | Optional custom base URL |

Get an API key: https://aistudio.google.com/apikey
