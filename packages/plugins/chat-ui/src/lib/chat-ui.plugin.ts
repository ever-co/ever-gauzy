import { Injector } from '@angular/core';
import { Routes } from '@angular/router';
import { Subscription } from 'rxjs';
import { FeatureEnum, PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PageExtensionDefinition, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { NavigationBuilderService, NavMenuBuilderService, PermissionsGuard } from '@gauzy/ui-core/core';
import {
	CHAT_EMPLOYEE_ACTIONS_SLOT,
	CHAT_HEADER_ACTION_ID,
	CHAT_MESSAGE_EMPLOYEE_EXTENSION_ID,
	CHAT_LINK,
	CHAT_NAV_BEFORE,
	CHAT_NAV_ID,
	CHAT_PATH,
	CHAT_SECTIONS_LOCATION,
	CHAT_SEND_TASK_EXTENSION_ID,
	CHAT_TASK_ACTIONS_SLOT,
	CHAT_THREADS_PATH,
	CHAT_UNREADS_PATH
} from './chat-ui.constants';
import { ChatHeaderBadgeComponent } from './components/chat-header-badge/chat-header-badge.component';
import { ChatAvailabilityService } from './services/chat-availability.service';
import { ChatPresenceReporterService } from './services/chat-presence-reporter.service';
import en from '../i18n/en.json';

/**
 * The page's views: home, Unreads, Threads, a conversation. They carry only the URL (the view's name, the
 * conversation id) and render nothing themselves (no component, empty children): the page reads the active one.
 */
export const CHAT_VIEW_ROUTES: Routes = [
	{ path: '', children: [] },
	{ path: CHAT_UNREADS_PATH, data: { view: 'unreads' }, children: [] },
	{ path: CHAT_THREADS_PATH, data: { view: 'threads' }, children: [] },
	{ path: ':conversationId', children: [] }
];

/**
 * The page (standalone, loaded on first visit) as ONE route above its views. Going from one view to another
 * (a conversation, Unreads, Threads) changes only the child, so the page, its sidebar and its lists stay alive and
 * only the main pane changes; one route per view would destroy and rebuild the whole page at every switch.
 */
export const CHAT_CHILD_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./components/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
		children: CHAT_VIEW_ROUTES
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

/**
 * "Send to chat" on a task's page, for users who may send (`CHAT_SEND`) where the tenant has the chat on; the button
 * itself shows only once the API serves the chat to the user (loaded on the first task page shown).
 */
export const CHAT_SEND_TASK_EXTENSION: PageExtensionDefinition = {
	id: CHAT_SEND_TASK_EXTENSION_ID,
	slotId: CHAT_TASK_ACTIONS_SLOT,
	loadComponent: () => import('./components/send-task-button/send-task-button.component').then((m) => m.SendTaskButtonComponent),
	permissions: [PermissionsEnum.CHAT_SEND],
	featureKey: FeatureEnum.FEATURE_CHAT,
	order: 50,
	metadata: { title: 'Send to chat', icon: 'message-circle-outline' }
};

/**
 * "Message" on an employee's page, for users who see the chat and may send (`CHAT_VIEW` and `CHAT_SEND`) where the tenant has the chat on: opens my
 * direct conversation with them, which the API finds or creates for senders only (`POST /chat/direct`). The button
 * itself shows only once the API serves the chat to the user.
 */
export const CHAT_MESSAGE_EMPLOYEE_EXTENSION: PageExtensionDefinition = {
	id: CHAT_MESSAGE_EMPLOYEE_EXTENSION_ID,
	slotId: CHAT_EMPLOYEE_ACTIONS_SLOT,
	loadComponent: () =>
		import('./components/message-employee-button/message-employee-button.component').then((m) => m.MessageEmployeeButtonComponent),
	// Both: every chat route asks for `CHAT_VIEW`, and finding or creating the conversation for `CHAT_SEND` too.
	permissions: [PermissionsEnum.CHAT_VIEW, PermissionsEnum.CHAT_SEND],
	featureKey: FeatureEnum.FEATURE_CHAT,
	order: 50,
	metadata: { title: 'Message', icon: 'message-circle-outline' }
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
	extensions: [CHAT_SEND_TASK_EXTENSION, CHAT_MESSAGE_EMPLOYEE_EXTENSION],
	featureKey: FeatureEnum.FEATURE_CHAT,
	permissionKeys: [PermissionsEnum.CHAT_VIEW],
	translationNamespace: 'CHAT',
	translations: { en }
});

/**
 * Chat UI plugin (`@gauzy/plugin-chat-ui`): `/pages/chat` (the conversations of the organization: channels in
 * their categories, direct and group messages, threads, reactions, pins and mentions, with my unread state, live
 * through the realtime events, with who is online), the header badge, the nav entry, "Send to chat" on a task's page and "Message" on an employee's page. Registered in `apps/gauzy/src/plugin-ui.config.ts`;
 * shows nothing but the route unless the API serves the chat.
 */
export const ChatUiPlugin: PluginUiDefinition = {
	...declarative,
	bootstrap: (injector: Injector) => {
		declarative.bootstrap?.(injector);
		registerChatEntryPoints(injector);
		// From every page: tells the organization this person is here, for the presence dots of the chat.
		injector.get(ChatPresenceReporterService).start();
	}
};
