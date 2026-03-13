# @gauzy/plugin-ai-chat-react-ui

React AI Chat plugin for the Gauzy platform, built with the [Vercel AI SDK](https://sdk.vercel.ai/) (`@ai-sdk/react`).

Design follows the [Vercel AI SDK Chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot) pattern.

## Features

- **Right Sidebar** — full-height chat panel that slides in from the right edge
- **Header Toggle** — compact button in the app header to expand / collapse the sidebar
- **Vercel AI SDK** — uses `useChat` hook from `@ai-sdk/react` for streaming AI responses
- **Markdown Rendering** — assistant responses rendered with rich formatting
- **Auto-scroll** — automatically scrolls to latest messages
- **Keyboard Shortcuts** — `Enter` to send, `Shift+Enter` for newline, `Escape` to collapse
- **Gauzy Design Tokens** — styled with `@gauzy/ui-react-components` theme tokens
- **Plugin System** — registered via `defineDeclarativePlugin` from `@gauzy/plugin-ui`

## Usage

```typescript
import { AiChatReactUiPlugin } from '@gauzy/plugin-ai-chat-react-ui';

export const PLUGIN_UI_CONFIG: PluginUiConfig = {
	plugins: [AiChatReactUiPlugin]
};
```

> **Note:** This is the frontend-only package. Backend chat API integration will be configured separately.
