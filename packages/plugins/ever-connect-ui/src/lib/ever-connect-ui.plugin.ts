import { Routes } from '@angular/router';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PageExtensionDefinition, PluginRouteInput } from '@gauzy/plugin-ui';
import { EVER_APPS_PLUGIN_OPTION } from '@gauzy/ui-core/common';
import en from '../i18n/en.json';
import { EVER_APP_CATALOG } from './ever-app-catalog';

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

/**
 * Ever Platform UI plugin (`@gauzy/plugin-ever-connect-ui`): Integrations > Ever Platform, the
 * confirmation page of a workspace created from Ever, and "Check on Ever Platform" on a contact.
 * The pages ask the API first; where the Ever Platform module is not loaded (the default) they only
 * say so, and the contact page shows no button. Its options carry the header app switcher's catalog
 * (`EVER_APP_CATALOG`), which the web app reads from the plugin list; without this plugin there is no switcher.
 */
export const EverConnectUiPlugin = defineDeclarativePlugin('ever-connect', {
	version: '0.1.0',
	location: 'integrations-sections',
	options: { [EVER_APPS_PLUGIN_OPTION]: EVER_APP_CATALOG },
	routes: [EVER_CONNECT_ROUTE, EVER_CONNECT_PROVISION_ROUTE],
	extensions: [CHECK_ON_EVER_PLATFORM_EXTENSION],
	permissionKeys: [PermissionsEnum.INTEGRATION_VIEW],
	translationNamespace: 'EVER_CONNECT',
	translations: { en }
});
