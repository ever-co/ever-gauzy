import { defineDeclarativePlugin, PluginNavItemInput, PluginRouteInput } from '@gauzy/plugin-ui';
import { NoAuthGuard } from '@gauzy/ui-core/core';
import en from '../i18n/en.json';
import { CONNECTED_IDENTITIES_LINK, CONNECTED_IDENTITIES_PATH, isEverIdSettingsVisible } from './ever-id-ui.state';

/** `#/auth/ever-id`: redeems the one-time key of an Ever ID sign-in. */
export const EVER_ID_HANDOFF_ROUTE: PluginRouteInput = {
	location: 'auth-sections',
	path: 'ever-id',
	loadComponent: () => import('./pages/ever-id-handoff.component').then((m) => m.EverIdHandoffComponent),
	canActivate: [NoAuthGuard]
};

/** `#/auth/ever-id/confirm`: Gauzy's one-time e-mail code before a confirmed link. */
export const EVER_ID_CONFIRM_ROUTE: PluginRouteInput = {
	location: 'auth-sections',
	path: 'ever-id/confirm',
	loadComponent: () => import('./pages/ever-id-confirm.component').then((m) => m.EverIdConfirmComponent),
	canActivate: [NoAuthGuard]
};

/** `#/auth/ever-id/signup`: "Create a Gauzy workspace with this Ever ID" (Ever Cloud only). */
export const EVER_ID_SIGNUP_ROUTE: PluginRouteInput = {
	location: 'auth-sections',
	path: 'ever-id/signup',
	loadComponent: () => import('./pages/ever-id-signup.component').then((m) => m.EverIdSignupComponent),
	canActivate: [NoAuthGuard]
};

/** `/pages/settings/connected-identities`: any signed-in person, for their own account. */
export const CONNECTED_IDENTITIES_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: CONNECTED_IDENTITIES_PATH,
	loadComponent: () => import('./pages/connected-identities.component').then((m) => m.ConnectedIdentitiesComponent),
	data: {
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false,
			organization: false
		}
	}
};

/**
 * Ever ID sign-in UI plugin (`@gauzy/plugin-auth-zitadel-ui`).
 *
 * Adds the pages the Ever ID sign-in redirects to and Settings > Connected identities. The settings
 * entry is shown only when the web app has an Ever ID sign-in link configured and the API reports the
 * Ever ID sign-in as enabled; otherwise nothing of this plugin is visible.
 */
export const AuthZitadelUiPlugin = defineDeclarativePlugin('auth-zitadel', {
	version: '0.1.0',
	location: 'settings-sections',
	routes: [EVER_ID_HANDOFF_ROUTE, EVER_ID_CONFIRM_ROUTE, EVER_ID_SIGNUP_ROUTE, CONNECTED_IDENTITIES_ROUTE],
	navMenu: [
		{
			type: 'section' as const,
			sectionId: 'settings',
			items: [
				{
					id: 'settings-connected-identities',
					title: 'Connected identities',
					icon: 'fas fa-id-badge',
					link: CONNECTED_IDENTITIES_LINK,
					data: {
						translationKey: 'AUTH_ZITADEL.SETTINGS.MENU',
						hide: () => !isEverIdSettingsVisible()
					}
				} as PluginNavItemInput
			]
		}
	],
	translationNamespace: 'AUTH_ZITADEL',
	translations: { en }
});
