import { Injector } from '@angular/core';
import { Routes } from '@angular/router';
import { Subscription } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { NavMenuBuilderService, PermissionsGuard } from '@gauzy/ui-core/core';
import en from '../i18n/en.json';
import { EverWorksInboxAvailabilityService } from './services/ever-works-inbox-availability.service';

/** Path of the page, relative to `/pages/integrations` (the `redirectUrl` of the catalog row). */
export const EVER_WORKS_PATH = 'ever-works';

/** Absolute link of the page. */
export const EVER_WORKS_LINK = `/pages/integrations/${EVER_WORKS_PATH}`;

/** Path of Settings → Ever Works inbox, relative to `/pages/settings` (`settings-sections`). */
export const EVER_WORKS_INBOX_PATH = 'ever-works-inbox';

/** Absolute link of Settings → Ever Works inbox. */
export const EVER_WORKS_INBOX_LINK = `/pages/settings/${EVER_WORKS_INBOX_PATH}`;

/** The core nav section the settings entry goes under, and its id. */
export const EVER_WORKS_INBOX_NAV_SECTION_ID = 'settings';
export const EVER_WORKS_INBOX_NAV_ID = 'settings-ever-works-inbox';

/**
 * The connect page at `''`, and the sync settings of a mapping under `:integrationTenantId` (the list of
 * connected integrations opens it that way).
 */
export const EVER_WORKS_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./components/ever-works-page/ever-works-page.component').then((m) => m.EverWorksPageComponent)
	},
	{
		path: ':integrationTenantId',
		loadComponent: () =>
			import('./components/settings/ever-works-settings.component').then((m) => m.EverWorksSettingsComponent)
	}
];

/** `/pages/integrations/ever-works`, for users who may see integrations. */
export const EVER_WORKS_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: EVER_WORKS_PATH,
	loadChildren: () => Promise.resolve(EVER_WORKS_CHILD_ROUTES),
	data: {
		permissions: {
			only: [PermissionsEnum.INTEGRATION_VIEW],
			redirectTo: '/pages/integrations'
		},
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false,
			organization: true
		}
	}
};

/**
 * `/pages/settings/ever-works-inbox`: which of my Gauzy Inbox items go to Ever Works. Any signed-in person with
 * `INBOX_VIEW` (as the API's route), for their own account: a child of the core settings shell, standalone and loaded
 * on first visit. Where the API does not load the Ever Works plugin the page says so.
 */
export const EVER_WORKS_INBOX_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: EVER_WORKS_INBOX_PATH,
	loadComponent: () =>
		import('./components/inbox-preferences/ever-works-inbox-preferences.component').then(
			(m) => m.EverWorksInboxPreferencesComponent
		),
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.INBOX_VIEW],
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

/** The Settings → Ever Works inbox entry of the core Settings nav section. */
export const EVER_WORKS_INBOX_NAV_ITEM = {
	id: EVER_WORKS_INBOX_NAV_ID,
	title: 'Ever Works inbox',
	icon: 'fas fa-paper-plane',
	link: EVER_WORKS_INBOX_LINK,
	data: {
		translationKey: 'EVER_WORKS.INBOX_PREFERENCES.MENU',
		permissionKeys: [PermissionsEnum.INBOX_VIEW]
	}
};

/**
 * Adds Settings → Ever Works inbox once the API answered the signed-in user's inbox preferences
 * (`EverWorksInboxAvailabilityService`), and hides it again when that changes (signed out, another user). Elsewhere
 * (`EVER_WORKS_ENABLED` unset, the default, or a user without `INBOX_VIEW`) the settings menu looks exactly as before;
 * the route still exists and the page then says the integration is off.
 *
 * The entry is hidden (`data.hide`) while it is not available, as the Inbox's own menu items are, and added again
 * (replacing itself) at each change: the menu reads `hide` only when it is built, so a new emission is what shows or
 * hides it.
 */
export function registerEverWorksInboxSettingsEntryPoints(injector: Injector): Subscription {
	const state = { available: false, added: false };
	return injector.get(EverWorksInboxAvailabilityService).available$.subscribe((available) => {
		const changed = available !== state.available;
		state.available = available;
		if ((available && !state.added) || (state.added && changed)) {
			state.added = true;
			const item = {
				...EVER_WORKS_INBOX_NAV_ITEM,
				data: { ...EVER_WORKS_INBOX_NAV_ITEM.data, hide: () => !state.available }
			};
			injector.get(NavMenuBuilderService).addNavMenuItems([item] as never, EVER_WORKS_INBOX_NAV_SECTION_ID);
		}
	});
}

const declarative = defineDeclarativePlugin('integration-ever-works', {
	version: '0.1.0',
	location: 'integrations-sections',
	routes: [EVER_WORKS_ROUTE, EVER_WORKS_INBOX_ROUTE],
	// Integrations > Ever Works for admins, Settings → Ever Works inbox for anyone with the Inbox.
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW, PermissionsEnum.INBOX_VIEW],
	translationNamespace: 'EVER_WORKS',
	translations: { en }
});

/**
 * Ever Works UI plugin (`@gauzy/plugin-integration-ever-works-ui`): Integrations > Ever Works, and Settings → Ever
 * Works inbox (which of my Gauzy Inbox items go to Ever Works). The pages ask the API first; where the Ever Works
 * plugin is not loaded (the default) they only say so, and the settings entry is not shown.
 */
export const IntegrationEverWorksUiPlugin: PluginUiDefinition = {
	...declarative,
	bootstrap: (injector: Injector) => {
		declarative.bootstrap?.(injector);
		registerEverWorksInboxSettingsEntryPoints(injector);
	}
};
