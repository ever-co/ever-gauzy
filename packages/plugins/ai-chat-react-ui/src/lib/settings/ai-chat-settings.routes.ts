import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { AiChatSettingsComponent } from './ai-chat-settings.component';

/** Path segment for the AI Providers settings page under /pages. */
export const AI_CHAT_SETTINGS_PATH = 'settings/ai';

/**
 * Route config for the per-tenant "AI Providers" (BYOK) settings page.
 * Registered at `page-sections` so it appears as /pages/settings/ai,
 * guarded by the `AI_CHAT_SETTINGS` permission (same PermissionsGuard
 * pattern as the core settings routes).
 */
export const AI_CHAT_SETTINGS_ROUTE: PageRouteRegistryConfig = {
	location: 'page-sections',
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
