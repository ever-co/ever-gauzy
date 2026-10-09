import { CanDeactivateFn } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { PageRouteRegistryConfig, PermissionsGuard } from '@gauzy/ui-core/core';
import { AiChatSettingsComponent } from './ai-chat-settings.component';

/**
 * Asks before a provider form with unsaved edits is left — by any navigation, not only the form's
 * own Back and Cancel buttons. See {@link AiChatSettingsComponent.canLeave}.
 */
export const confirmUnsavedAiSettings: CanDeactivateFn<AiChatSettingsComponent> = (component, _route, _state, nextState) =>
	component.canLeave(nextState);

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
	canDeactivate: [confirmUnsavedAiSettings],
	// The page's three views are query params on this one route, so leaving the provider form for
	// the list, the catalog or another provider is a query-param change — guards must run on those.
	runGuardsAndResolvers: 'paramsOrQueryParamsChange',
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
