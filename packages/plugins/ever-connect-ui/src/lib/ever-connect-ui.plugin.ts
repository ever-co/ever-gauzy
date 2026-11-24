import { Injector } from '@angular/core';
import { Routes } from '@angular/router';
import { Subscription } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	defineDeclarativePlugin,
	PageExtensionDefinition,
	PluginRouteInput,
	PluginUiDefinition
} from '@gauzy/plugin-ui';
import { EVER_APPS_PLUGIN_OPTION } from '@gauzy/ui-core/common';
import { NavMenuBuilderService } from '@gauzy/ui-core/core';
import en from '../i18n/en.json';
import { EVER_APP_CATALOG } from './ever-app-catalog';
import { EverPlatformMenuService } from './services/ever-platform-menu.service';

/** Path of the page, relative to `/pages/integrations` (the `redirectUrl` of the integration). */
export const EVER_CONNECT_PATH = 'ever-connect';

/** Absolute link of the page. */
export const EVER_CONNECT_LINK = `/pages/integrations/${EVER_CONNECT_PATH}`;

/** The page, also under `:integrationTenantId` (the list of connected integrations opens it that way). */
export const EVER_CONNECT_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () =>
			import('./components/ever-platform-page/ever-platform-page.component').then(
				(m) => m.EverPlatformPageComponent
			)
	},
	{
		path: ':integrationTenantId',
		loadComponent: () =>
			import('./components/ever-platform-page/ever-platform-page.component').then(
				(m) => m.EverPlatformPageComponent
			)
	}
];

/** `/pages/integrations/ever-connect`, for users who may see integrations. */
export const EVER_CONNECT_ROUTE: PluginRouteInput = {
	location: 'integrations-sections',
	path: EVER_CONNECT_PATH,
	loadChildren: () => Promise.resolve(EVER_CONNECT_CHILD_ROUTES),
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
 * `#/auth/ever-connect/provision?provision=…&handoff=…`: the one confirmation of creating a workspace a
 * person asked for in Ever, after their Ever ID sign-in. Not behind the signed-out guard: a person who
 * is signed in to another workspace in this browser confirms it the same way. Its API answers 404
 * unless the operator switched it on.
 */
export const EVER_CONNECT_PROVISION_ROUTE: PluginRouteInput = {
	location: 'auth-sections',
	path: 'ever-connect/provision',
	loadComponent: () => import('./provision/provision-confirm.component').then((m) => m.ProvisionConfirmComponent)
};

/** The slot of the contact page's header where a plugin may add an action for the contact. */
export const CONTACT_VIEW_ACTIONS_SLOT = 'contact-view-actions';

/**
 * "Check on Ever Platform" on a contact, for people who may see integrations. It renders nothing
 * unless the API says the counterparty check is enabled for the organization (and, where the Ever
 * Platform module is not loaded, the API's 404 hides it).
 */
export const CHECK_ON_EVER_PLATFORM_EXTENSION: PageExtensionDefinition = {
	id: 'ever-connect-check-on-ever-platform',
	slotId: CONTACT_VIEW_ACTIONS_SLOT,
	loadComponent: () =>
		import('./components/check-on-ever-platform-button/check-on-ever-platform-button.component').then(
			(m) => m.CheckOnEverPlatformButtonComponent
		),
	permissions: [PermissionsEnum.INTEGRATION_VIEW],
	wrapper: 'none'
};

/** The core nav section the operator's entry goes under, and its id. */
export const EVER_PLATFORM_NAV_SECTION_ID = 'settings';
export const EVER_PLATFORM_NAV_ID = 'settings-ever-platform';

/** Settings > Ever Platform: the operator's way to the Connection tab of Integrations > Ever Platform. */
export const EVER_PLATFORM_NAV_ITEM = {
	id: EVER_PLATFORM_NAV_ID,
	title: 'Ever Platform',
	icon: 'fas fa-plug',
	link: EVER_CONNECT_LINK,
	data: {
		translationKey: 'EVER_CONNECT.MENU',
		permissionKeys: [PermissionsEnum.INTEGRATION_VIEW]
	}
};

/**
 * Adds Settings > Ever Platform once the API's menu probe answered (`EverPlatformMenuService`): only where the
 * Ever Platform module is loaded and only for the operator of the installation's connection; it hides it again
 * when that changes (signed out, another user). Elsewhere (`EVER_CONNECT_ENABLED` unset, the default, or anyone
 * but the operator) the menu looks exactly as before; Integrations > Ever Platform stays where it is.
 *
 * The entry is hidden (`data.hide`) while it is not available and added again (replacing itself) at each change:
 * the menu reads `hide` only when it is built, so a new emission is what shows or hides it.
 */
export function registerEverPlatformMenu(injector: Injector): Subscription {
	const state = { available: false, added: false };
	return injector.get(EverPlatformMenuService).available$.subscribe((available) => {
		const changed = available !== state.available;
		state.available = available;
		if ((available && !state.added) || (state.added && changed)) {
			state.added = true;
			const item = {
				...EVER_PLATFORM_NAV_ITEM,
				data: { ...EVER_PLATFORM_NAV_ITEM.data, hide: () => !state.available }
			};
			injector.get(NavMenuBuilderService).addNavMenuItems([item] as never, EVER_PLATFORM_NAV_SECTION_ID);
		}
	});
}

const declarative = defineDeclarativePlugin('ever-connect', {
	version: '0.1.0',
	location: 'integrations-sections',
	options: { [EVER_APPS_PLUGIN_OPTION]: EVER_APP_CATALOG },
	routes: [EVER_CONNECT_ROUTE, EVER_CONNECT_PROVISION_ROUTE],
	extensions: [CHECK_ON_EVER_PLATFORM_EXTENSION],
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
	translationNamespace: 'EVER_CONNECT',
	translations: { en }
});

/**
 * Ever Platform UI plugin (`@gauzy/plugin-ever-connect-ui`): Integrations > Ever Platform, the
 * confirmation page of a workspace created from Ever, "Check on Ever Platform" on a contact, and
 * Settings > Ever Platform for the operator where the module is loaded. The pages ask the API first;
 * where the Ever Platform module is not loaded (the default) they only say so, the contact page
 * shows no button and the settings menu has no entry. Its options carry the header app switcher's
 * catalog (`EVER_APP_CATALOG`), which the web app reads from the plugin list; without this plugin
 * there is no switcher.
 */
export const EverConnectUiPlugin: PluginUiDefinition = {
	...declarative,
	bootstrap: (injector: Injector) => {
		declarative.bootstrap?.(injector);
		registerEverPlatformMenu(injector);
	}
};
