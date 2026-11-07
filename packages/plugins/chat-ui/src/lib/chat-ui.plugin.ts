import { Injector } from '@angular/core';
import { Routes } from '@angular/router';
import { Subscription } from 'rxjs';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { NavigationBuilderService, NavMenuBuilderService, PermissionsGuard } from '@gauzy/ui-core/core';
import {
	CHAT_HEADER_ACTION_ID,
	CHAT_LINK,
	CHAT_NAV_BEFORE,
	CHAT_NAV_ID,
	CHAT_PATH,
	CHAT_SECTIONS_LOCATION,
	CHAT_THREADS_PATH,
	CHAT_UNREADS_PATH
} from './chat-ui.constants';
import { ChatHeaderBadgeComponent } from './components/chat-header-badge/chat-header-badge.component';
import { ChatAvailabilityService } from './services/chat-availability.service';
import en from '../i18n/en.json';

/** The page (standalone, loaded on first visit) with its views: a conversation, Unreads, Threads. */
export const CHAT_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./components/chat-page/chat-page.component').then((m) => m.ChatPageComponent)
	},
	{
		path: CHAT_UNREADS_PATH,
		loadComponent: () => import('./components/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
		data: { view: 'unreads' }
	},
	{
		path: CHAT_THREADS_PATH,
		loadComponent: () => import('./components/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
		data: { view: 'threads' }
	},
	{
		path: ':conversationId',
		loadComponent: () => import('./components/chat-page/chat-page.component').then((m) => m.ChatPageComponent)
	}
];

/** `/pages/chat`, for users with `CHAT_VIEW`. */
export const CHAT_PAGE_ROUTE: PluginRouteInput = {
	location: 'page-sections',
	path: CHAT_PATH,
	loadChildren: () => Promise.resolve(CHAT_CHILD_ROUTES),
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.CHAT_VIEW],
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

/** The nav-menu entry, added once the API confirmed it serves the chat (`ChatAvailabilityService`). */
export const CHAT_NAV_SECTION = {
	id: CHAT_NAV_ID,
	title: 'Chat',
	icon: 'fas fa-comments',
	link: CHAT_LINK,
	pathMatch: 'prefix' as const,
	data: {
		translationKey: 'CHAT.MENU',
		featureKey: FeatureEnum.FEATURE_CHAT,
		permissionKeys: [PermissionsEnum.CHAT_VIEW]
	}
	// No `items` key: an empty children array makes Nebular treat the entry as a group (see docs-ui).
};

/**
 * Adds the nav entry and the header badge once the API serves the chat to the signed-in user, and takes them
 * away again when that changes (signed out, another user). Where the API does not load `@gauzy/plugin-chat`,
 * or `FEATURE_CHAT` is off for the tenant, neither appears, so the app looks exactly as before; the route still
 * exists and the page then says the chat is off.
 *
 * The nav builder has no way to remove a section, so the entry is hidden (`data.hide`) while the chat is not
 * available, and added again (replacing itself) at each change, so the menu is built anew and reads `hide` again;
 * the header action is removed and added again.
 */
export function registerChatEntryPoints(injector: Injector): Subscription {
	const state = { available: false, navAdded: false, badgeAdded: false };
	return injector.get(ChatAvailabilityService).available$.subscribe((available) => {
		const changed = available !== state.available;
		state.available = available;
		const header = injector.get(NavigationBuilderService);
		if ((available && !state.navAdded) || (state.navAdded && changed)) {
			state.navAdded = true;
			injector.get(NavMenuBuilderService).addNavMenuSection(
				{
					...CHAT_NAV_SECTION,
					data: { ...CHAT_NAV_SECTION.data, hide: () => !state.available }
				} as never,
				CHAT_NAV_BEFORE
			);
		}
		if (available && !state.badgeAdded) {
			state.badgeAdded = true;
			header.registerHeaderAction({
				id: CHAT_HEADER_ACTION_ID,
				component: ChatHeaderBadgeComponent,
				order: 9,
				class: 'chat-action',
				permissions: [PermissionsEnum.CHAT_VIEW]
			});
		} else if (!available && state.badgeAdded) {
			state.badgeAdded = false;
			header.removeHeaderAction(CHAT_HEADER_ACTION_ID);
		}
	});
}

const declarative = defineDeclarativePlugin('chat', {
	version: '0.1.0',
	location: CHAT_SECTIONS_LOCATION,
	routes: [CHAT_PAGE_ROUTE],
	featureKey: FeatureEnum.FEATURE_CHAT,
	permissionKeys: [PermissionsEnum.CHAT_VIEW],
	translationNamespace: 'CHAT',
	translations: { en }
});

/**
 * Chat UI plugin (`@gauzy/plugin-chat-ui`): `/pages/chat` (the conversations of the organization: channels in
 * their categories, direct and group messages, threads, reactions, pins and mentions, with my unread state), the
 * header badge (my states polled every 60 s) and the nav entry. Registered in `apps/gauzy/src/plugin-ui.config.ts`;
 * shows nothing but the route unless the API serves the chat.
 */
export const ChatUiPlugin: PluginUiDefinition = {
	...declarative,
	bootstrap: (injector: Injector) => {
		declarative.bootstrap?.(injector);
		registerChatEntryPoints(injector);
	}
};
