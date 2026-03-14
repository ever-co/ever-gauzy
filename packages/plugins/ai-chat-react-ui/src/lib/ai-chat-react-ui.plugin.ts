import { defineDeclarativePlugin, PluginRouteInput } from '@gauzy/plugin-ui';
import { PLAYGROUND_ROUTE } from './playground.routes';
import { provideAiChatPlaygroundSidebar } from './provide-ai-chat-playground-sidebar';
import en from '../i18n/en.json';

/**
 * AI Chat React UI Plugin Definition.
 *
 * Self-contained plugin that registers:
 * - An AI Playground page at `/pages/playground` (Vercel AI SDK style)
 * - A chat sidebar panel in the layout's dedicated chat slot
 *
 * Uses `defineDeclarativePlugin` with `providers` for the chat sidebar
 * and declarative `routes` for the playground page. No external provider
 * (e.g. in `bootstrap.module.ts`) is needed.
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
	},

	// ── Providers ────────────────────────────────────────────────
	providers: [provideAiChatPlaygroundSidebar()]
});
