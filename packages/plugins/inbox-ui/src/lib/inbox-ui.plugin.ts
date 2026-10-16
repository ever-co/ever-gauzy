import { Injector } from '@angular/core';
import { Routes } from '@angular/router';
import { Subscription } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { NavigationBuilderService, NavMenuBuilderService, PermissionsGuard } from '@gauzy/ui-core/core';
import {
	INBOX_HEADER_ACTION_ID,
	INBOX_LINK,
	INBOX_NAV_ID,
	INBOX_PATH,
	INBOX_SECTIONS_LOCATION
} from './inbox-ui.constants';
import { InboxHeaderBadgeComponent } from './components/inbox-header-badge/inbox-header-badge.component';
import { InboxAvailabilityService } from './services/inbox-availability.service';
import en from '../i18n/en.json';

/** The page (standalone, loaded on first visit). */
export const INBOX_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./components/inbox-page/inbox-page.component').then((m) => m.InboxPageComponent)
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
 * The nav builder has no way to remove a section, so the entry is added once and hidden (`data.hide`) while
 * the Inbox is not available; the header action is removed and added again.
 */
export function registerInboxEntryPoints(injector: Injector): Subscription {
	const state = { available: false, navAdded: false, badgeAdded: false };
	return injector.get(InboxAvailabilityService).available$.subscribe((available) => {
		state.available = available;
		const header = injector.get(NavigationBuilderService);
		if (available && !state.navAdded) {
			state.navAdded = true;
			injector
				.get(NavMenuBuilderService)
				.addNavMenuSection(
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
	routes: [INBOX_PAGE_ROUTE],
	permissionKeys: [PermissionsEnum.INBOX_VIEW],
	translationNamespace: 'INBOX',
	translations: { en }
});

/**
 * Inbox UI plugin (`@gauzy/plugin-inbox-ui`, plan 04 §1, G-P3-2): `/pages/inbox` (All, Decisions, Email,
 * Notifications, Archived), the header badge (counts polled every 60 s) and the nav entry. Registered in
 * `apps/gauzy/src/plugin-ui.config.ts`; shows nothing but the route unless the API serves the Inbox.
 */
export const InboxUiPlugin: PluginUiDefinition = {
	...declarative,
	bootstrap: (injector: Injector) => {
		declarative.bootstrap?.(injector);
		registerInboxEntryPoints(injector);
	}
};
