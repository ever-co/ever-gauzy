import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput } from '@gauzy/plugin-ui';
import { PLAYGROUND_ROUTE } from './playground.routes';
import { AI_CHAT_SETTINGS_ROUTE } from './settings';
import { provideAiChatSidebar } from './provide-ai-chat-sidebar';
import en from '../i18n/en.json';

/**
 * AI Chat React UI Plugin Definition.
 *
 * Self-contained plugin that registers:
 * - An AI Playground page at `/pages/playground` (Vercel AI SDK style)
 * - A per-tenant "AI Providers" (BYOK) settings page at `/pages/settings/ai`
 *   with a nav item under the core Settings section (AI_CHAT_SETTINGS permission)
 * - The AI Chat panel in the layout's dedicated chat sidebar slot
 *   (`Menu | Chat | Page content`)
 *
 * Uses `defineDeclarativePlugin` with `providers` for the chat sidebar
 * and declarative `routes` for the playground page. No external provider
 * (e.g. in `bootstrap.module.ts`) is needed.
 *
 * The chat talks to the `@gauzy/plugin-ai-chat` backend plugin
 * (`POST /api/ai-chat`, Vercel AI SDK UI message stream).
 */
export const AiChatReactUiPlugin = defineDeclarativePlugin('ai-chat-react-ui', {
	// ── Versioning & Compatibility ────────────────────────────────
	version: '1.0.0',

	// ── Routes ───────────────────────────────────────────────────
	routes: [PLAYGROUND_ROUTE as PluginRouteInput, AI_CHAT_SETTINGS_ROUTE as PluginRouteInput],

	// ── Nav menu (item under the core Settings section) ──────────
	navMenu: [
		{
			type: 'section',
			sectionId: 'settings',
			items: [
				{
					id: 'settings-ai-providers',
					title: 'AI Providers',
					icon: 'fas fa-robot',
					link: '/pages/settings/ai',
					data: {
						translationKey: 'AI_CHAT_UI.SETTINGS.MENU_ITEM',
						permissionKeys: [PermissionsEnum.AI_CHAT_SETTINGS]
					}
				}
			]
		}
	],

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
	providers: [provideAiChatSidebar()]
});
