import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { AiChatSettingsComponent } from './ai-chat-settings.component';

/**
 * Path segment for the AI Providers settings page, RELATIVE to /pages/settings
 * (the route is registered as a child of the settings shell).
 */
export const AI_CHAT_SETTINGS_PATH = 'ai';

/**
 * Route config for the per-tenant "AI Providers" (BYOK) settings page.
 *
 * Registered at `settings-sections` — i.e. as a CHILD of the settings shell —
 * so the page renders with the settings menu beside it, exactly like the core
 * settings pages. (Registering at `page-sections` would still resolve
 * /pages/settings/ai, but standalone, without the settings menu.)
 *
 * Guarded by the `AI_CHAT_SETTINGS` permission, matching the PermissionsGuard
 * pattern used by the core settings routes.
 */
export const AI_CHAT_SETTINGS_ROUTE: PageRouteRegistryConfig = {
	location: 'settings-sections',
	path: AI_CHAT_SETTINGS_PATH,
	component: AiChatSettingsComponent,
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.AI_CHAT_SETTINGS],
			redirectTo: '/pages/settings'
		},
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false,
			organization: false
		}
	}
};
