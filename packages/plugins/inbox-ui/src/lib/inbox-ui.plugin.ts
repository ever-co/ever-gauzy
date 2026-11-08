import { Injector } from '@angular/core';
import { Routes } from '@angular/router';
import { Subscription } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { AuthStrategy, NavigationBuilderService, NavMenuBuilderService, PermissionsGuard, Store } from '@gauzy/ui-core/core';
import { distinctUntilChanged, filter, map } from 'rxjs/operators';
import {
	INBOX_HEADER_ACTION_ID,
	INBOX_LINK,
	INBOX_MAILBOXES_NAV_ID,
	INBOX_MAILBOXES_SETTINGS_LINK,
	INBOX_MAILBOXES_SETTINGS_PATH,
	INBOX_MY_MAILBOX_PATH,
	INBOX_NAV_ID,
	INBOX_NOTIFICATION_SETTINGS_LINK,
	INBOX_NOTIFICATION_SETTINGS_NAV_ID,
	INBOX_NOTIFICATION_SETTINGS_PATH,
	INBOX_PATH,
	INBOX_PROVIDERS_NAV_ID,
	INBOX_PROVIDERS_SETTINGS_LINK,
	INBOX_PROVIDERS_SETTINGS_PATH,
	INBOX_SECTIONS_LOCATION,
	INBOX_SETTINGS_NAV_SECTION_ID
} from './inbox-ui.constants';
import { InboxHeaderBadgeComponent } from './components/inbox-header-badge/inbox-header-badge.component';
import { InboxAvailabilityService } from './services/inbox-availability.service';
import { InboxEmailAvailabilityService } from './services/inbox-email-availability.service';
import { InboxWebPushService } from './services/inbox-web-push.service';
import en from '../i18n/en.json';

/** The page and "My mailbox" (standalone, each loaded on first visit). */
export const INBOX_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./components/inbox-page/inbox-page.component').then((m) => m.InboxPageComponent)
	},
	{
		// `/pages/inbox/mailbox` (G-P4-1): my addresses and their forwarding instructions; INBOX_VIEW, as the page.
		path: INBOX_MY_MAILBOX_PATH,
		loadComponent: () => import('./settings/my-mailbox-page.component').then((m) => m.InboxMyMailboxPageComponent)
	}
];

/** `/pages/inbox`, for users with `INBOX_VIEW`. */
export const INBOX_PAGE_ROUTE: PluginRouteInput = {
	location: 'page-sections',
	path: INBOX_PATH,
	loadChildren: () => Promise.resolve(INBOX_CHILD_ROUTES),
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.INBOX_VIEW],
			redirectTo: '/pages/dashboard'
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

/** The route data of a Settings → Inbox page: `INBOX_MAILBOX_MANAGE`, as the API's management routes. */
const INBOX_SETTINGS_ROUTE_DATA = {
	permissions: {
		only: [PermissionsEnum.INBOX_MAILBOX_MANAGE],
		redirectTo: '/pages/settings'
	},
	selectors: {
		project: false,
		team: false,
		employee: false,
		date: false,
		organization: true
	}
};

/**
 * Settings → Inbox → Providers (`/pages/settings/inbox-providers`, G-P4-2), a child of the core settings shell
 * (`settings-sections`), standalone and loaded on first visit.
 */
export const INBOX_PROVIDERS_SETTINGS_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: INBOX_PROVIDERS_SETTINGS_PATH,
	loadComponent: () => import('./settings/inbox-providers-page.component').then((m) => m.InboxProvidersPageComponent),
	canActivate: [PermissionsGuard],
	data: INBOX_SETTINGS_ROUTE_DATA
};

/** Settings → Inbox → Mailboxes (`/pages/settings/inbox-mailboxes`, G-P4-1), like the providers page. */
export const INBOX_MAILBOXES_SETTINGS_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: INBOX_MAILBOXES_SETTINGS_PATH,
	loadComponent: () => import('./settings/inbox-mailboxes-page.component').then((m) => m.InboxMailboxesPageComponent),
	canActivate: [PermissionsGuard],
	data: INBOX_SETTINGS_ROUTE_DATA
};

/**
 * Settings → Notifications (`/pages/settings/notifications`, the Inbox spec T15): the employee's own notification
 * setting — switches, email modes, quiet hours, digest hour. Served to every signed-in user (the setting is the
 * platform's, whether or not the Inbox is on); the page says so when the user is not an employee here.
 */
export const INBOX_NOTIFICATION_SETTINGS_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: INBOX_NOTIFICATION_SETTINGS_PATH,
	loadComponent: () => import('./settings/notification-settings-page.component').then((m) => m.InboxNotificationSettingsPageComponent),
	data: {
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false,
			organization: true
		}
	}
};

/** The Settings → Notifications entry of the core Settings nav section, for every signed-in user. */
export const INBOX_NOTIFICATION_SETTINGS_NAV_ITEM = {
	id: INBOX_NOTIFICATION_SETTINGS_NAV_ID,
	title: 'Notifications',
	icon: 'fas fa-bell',
	link: INBOX_NOTIFICATION_SETTINGS_LINK,
	data: {
		translationKey: 'INBOX.NOTIFICATION_SETTINGS.MENU'
	}
};

/** The Settings → Inbox entries of the core Settings nav section (`INBOX_MAILBOX_MANAGE`). */
export const INBOX_SETTINGS_NAV_ITEMS = [
	{
		id: INBOX_PROVIDERS_NAV_ID,
		title: 'Inbox providers',
		icon: 'fas fa-plug',
		link: INBOX_PROVIDERS_SETTINGS_LINK,
		data: {
			translationKey: 'INBOX.SETTINGS.MENU_PROVIDERS',
			permissionKeys: [PermissionsEnum.INBOX_MAILBOX_MANAGE]
		}
	},
	{
		id: INBOX_MAILBOXES_NAV_ID,
		title: 'Inbox mailboxes',
		icon: 'fas fa-at',
		link: INBOX_MAILBOXES_SETTINGS_LINK,
		data: {
			translationKey: 'INBOX.SETTINGS.MENU_MAILBOXES',
			permissionKeys: [PermissionsEnum.INBOX_MAILBOX_MANAGE]
		}
	}
];

/**
 * Adds the Settings → Inbox entries once the API confirmed it serves the Inbox email features to the signed-in user
 * (`InboxEmailAvailabilityService`: asked only where the Inbox itself is served, the same check as the nav entry and
 * the badge), and hides them again when that changes. Elsewhere (`GAUZY_INBOX_EMAIL_ENABLED` unset, the default) the
 * settings menu looks exactly as before; the routes still exist and the pages then say the email features are off.
 */
export function registerInboxSettingsEntryPoints(injector: Injector): Subscription {
	const state = { available: false, added: false };
	return injector.get(InboxEmailAvailabilityService).available$.subscribe((available) => {
		const changed = available !== state.available;
		state.available = available;
		// Added on the first `true`, and again (it replaces itself) at every change after: the menu reads `hide`
		// only when it is built, so a new emission is what shows or hides the entries (review F68).
		if ((available && !state.added) || (state.added && changed)) {
			state.added = true;
			injector.get(NavMenuBuilderService).addNavMenuItems(
				INBOX_SETTINGS_NAV_ITEMS.map((item) => ({
					...item,
					data: { ...item.data, hide: () => !state.available }
				})) as never,
				INBOX_SETTINGS_NAV_SECTION_ID
			);
		}
	});
}

/** The nav-menu entry, added once the API confirmed it serves the Inbox (`InboxAvailabilityService`). */
export const INBOX_NAV_SECTION = {
	id: INBOX_NAV_ID,
	title: 'Inbox',
	icon: 'fas fa-inbox',
	link: INBOX_LINK,
	pathMatch: 'prefix' as const,
	data: {
		translationKey: 'INBOX.MENU',
		permissionKeys: [PermissionsEnum.INBOX_VIEW]
	}
	// No `items` key: an empty children array makes Nebular treat the entry as a group (see docs-ui).
};

/**
 * Adds the nav entry and the header badge once the API serves the Inbox to the signed-in user, and takes them
 * away again when that changes (signed out, another user). Where the API does not load `@gauzy/plugin-inbox`
 * (`GAUZY_INBOX_ENABLED` unset, the default) neither appears, so the app looks exactly as before; the route
 * still exists and the page then says the Inbox is off.
 *
 * The nav builder has no way to remove a section, so the entry is hidden (`data.hide`) while the Inbox is not
 * available, and added again (replacing itself) at each change, so the menu is built anew and reads `hide` again;
 * the header action is removed and added again.
 */
export function registerInboxEntryPoints(injector: Injector): Subscription {
	const state = { available: false, navAdded: false, badgeAdded: false };
	return injector.get(InboxAvailabilityService).available$.subscribe((available) => {
		const changed = available !== state.available;
		state.available = available;
		const header = injector.get(NavigationBuilderService);
		// Added on the first `true`, and again (the same id replaces itself) at every change after: the menu reads
		// `hide` only when it is built, so a later sign-in would otherwise leave the entry hidden (review F68).
		if ((available && !state.navAdded) || (state.navAdded && changed)) {
			state.navAdded = true;
			injector.get(NavMenuBuilderService).addNavMenuSection(
				{
					...INBOX_NAV_SECTION,
					data: { ...INBOX_NAV_SECTION.data, hide: () => !state.available }
				} as never,
				'focus'
			);
		}
		if (available && !state.badgeAdded) {
			state.badgeAdded = true;
			header.registerHeaderAction({
				id: INBOX_HEADER_ACTION_ID,
				component: InboxHeaderBadgeComponent,
				order: 10,
				class: 'inbox-action',
				permissions: [PermissionsEnum.INBOX_VIEW]
			});
		} else if (!available && state.badgeAdded) {
			state.badgeAdded = false;
			header.removeHeaderAction(INBOX_HEADER_ACTION_ID);
		}
	});
}

const declarative = defineDeclarativePlugin('inbox', {
	version: '0.1.0',
	location: INBOX_SECTIONS_LOCATION,
	routes: [INBOX_PAGE_ROUTE, INBOX_NOTIFICATION_SETTINGS_ROUTE, INBOX_PROVIDERS_SETTINGS_ROUTE, INBOX_MAILBOXES_SETTINGS_ROUTE],
	permissionKeys: [PermissionsEnum.INBOX_VIEW],
	translationNamespace: 'INBOX',
	translations: { en }
});

/**
 * Inbox UI plugin (`@gauzy/plugin-inbox-ui`, plan 04 §1, G-P3-2): `/pages/inbox` (All, Decisions, Email,
 * Notifications, Archived), the header badge (counts polled every 60 s) and the nav entry; Settings → Inbox →
 * Providers (G-P4-2) and Mailboxes and "My mailbox" (G-P4-1) where the API serves the Inbox email features. Registered in
 * `apps/gauzy/src/plugin-ui.config.ts`; shows nothing but the route unless the API serves the Inbox.
 */
export const InboxUiPlugin: PluginUiDefinition = {
	...declarative,
	bootstrap: (injector: Injector) => {
		declarative.bootstrap?.(injector);
		// The notification setting is the platform's: its page is in Settings whether or not the Inbox is served.
		injector.get(NavMenuBuilderService).addNavMenuItems([INBOX_NOTIFICATION_SETTINGS_NAV_ITEM] as never, INBOX_SETTINGS_NAV_SECTION_ID);
		registerInboxEntryPoints(injector);
		registerInboxSettingsEntryPoints(injector);
		// A sign-out ends this browser's inbox notifications (a shared browser): the device is removed while the session
		// still allows it, and the browser unsubscribes. `logout$` does not wait for that: what holds without waiting is
		// told on `forgetThisBrowser`. An account that opens the app has its own subscribed browser registered again, and
		// any other subscription ended.
		const push = injector.get(InboxWebPushService);
		// Optional: a shell without the auth strategy (none today) simply has nothing to end.
		injector.get(AuthStrategy, null)?.logout$.subscribe(() => void push.forgetThisBrowser());
		injector
			.get(Store)
			.user$.pipe(
				map((user) => user?.id ?? null),
				distinctUntilChanged(),
				filter((userId): userId is string => !!userId)
			)
			.subscribe(() => void push.resync());
	}
};
