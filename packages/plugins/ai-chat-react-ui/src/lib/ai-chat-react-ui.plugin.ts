import { defineDeclarativePlugin, PluginRouteInput } from '@gauzy/plugin-ui';
import { PLAYGROUND_ROUTE } from './playground.routes';
import en from '../i18n/en.json';

/**
 * AI Chat React UI Plugin Definition.
 *
 * Registers:
 * - An inline collapsible AI Chat widget for the left sidebar
 * - An AI Playground page at `/pages/playground` (Vercel AI SDK style)
 *
 * Uses `defineDeclarativePlugin` — no Angular NgModule or manual service
 * injection required. Registration flows through `plugin-ui.config.ts`.
 *
 * ## Features
 *
 * - **Vercel AI SDK**: `useChat` hook for streaming chat completions
 * - **AI Playground**: Full page with settings panel + chat (at /pages/playground)
 * - **Left Sidebar**: Inline collapsible widget below nav menu
 * - **Toggle Bar**: Click to expand / collapse the chat panel
 * - **Markdown Rendering**: Rich formatting for assistant messages
 * - **Keyboard Shortcuts**: Enter to send, Escape to collapse
 * - **Dark Theme**: Styled for the Gauzy dark sidebar background
 *
 * > **Note:** Backend API endpoint is not yet configured.
 * > The `useChat` hook's `api` option will be set once the backend is ready.
 */
export const AiChatReactUiPlugin = defineDeclarativePlugin('ai-chat-react-ui', {
	// ── Versioning & Compatibility ────────────────────────────────
	version: '1.0.0',

	// ── Routes ───────────────────────────────────────────────────
	routes: [PLAYGROUND_ROUTE as PluginRouteInput],

	// ── Namespace-isolated translations ──────────────────────────
	translationNamespace: 'AI_CHAT_UI',
	translations: { en },

	// ── Plugin Settings (auto-generated UI) ──────────────────────
	settings: {
		title: 'AI Chat',
		description: 'Configure the AI Chat assistant widget in the sidebar.',
		category: 'ai',
		fields: [
			{
				key: 'chatEnabled',
				type: 'boolean',
				label: 'Enable AI Chat',
				defaultValue: true,
				order: 1
			},
			{
				key: 'defaultExpanded',
				type: 'boolean',
				label: 'Open chat expanded by default',
				defaultValue: false,
				order: 2
			}
		]
	}
});
