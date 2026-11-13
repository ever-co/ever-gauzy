import { Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { NavigationBuilderService, NavMenuBuilderService } from '@gauzy/ui-core/core';
import { CHAT_HEADER_ACTION_ID, CHAT_LINK, CHAT_NAV_BEFORE, CHAT_NAV_ID, CHAT_THREADS_PATH, CHAT_UNREADS_PATH } from './chat-ui.constants';
import { CHAT_CHILD_ROUTES, CHAT_PAGE_ROUTE, CHAT_VIEW_ROUTES, ChatUiPlugin, registerChatEntryPoints } from './chat-ui.plugin';
import { ChatAvailabilityService } from './services/chat-availability.service';

describe('ChatUiPlugin', () => {
	function injectorWith(available: BehaviorSubject<boolean>) {
		const nav = { addNavMenuSection: jest.fn() };
		const header = { registerHeaderAction: jest.fn(), removeHeaderAction: jest.fn() };
		const availability = { available$: available.asObservable() as unknown as ChatAvailabilityService['available$'] };
		const injector = Injector.create({
			providers: [
				{ provide: NavMenuBuilderService, useValue: nav },
				{ provide: NavigationBuilderService, useValue: header },
				{ provide: ChatAvailabilityService, useValue: availability }
			]
		});
		return { injector, nav, header };
	}

	it('registers the page route for CHAT_VIEW with its views', () => {
		expect(CHAT_PAGE_ROUTE.path).toBe('chat');
		expect(CHAT_PAGE_ROUTE.location).toBe('page-sections');
		expect((CHAT_PAGE_ROUTE.data as { permissions: { only: PermissionsEnum[] } }).permissions.only).toEqual([PermissionsEnum.CHAT_VIEW]);
		// One page route above componentless views, so switching views keeps the page (and its sidebar) alive.
		expect(CHAT_CHILD_ROUTES).toHaveLength(1);
		expect(CHAT_CHILD_ROUTES[0].path).toBe('');
		expect(CHAT_CHILD_ROUTES[0].loadComponent).toBeDefined();
		expect(CHAT_CHILD_ROUTES[0].children).toBe(CHAT_VIEW_ROUTES);
		expect(CHAT_VIEW_ROUTES.map((route) => route.path)).toEqual(['', CHAT_UNREADS_PATH, CHAT_THREADS_PATH, ':conversationId']);
		expect(CHAT_VIEW_ROUTES.every((route) => !route.component && !route.loadComponent)).toBe(true);
		expect(CHAT_VIEW_ROUTES.map((route) => route.data?.['view'] ?? null)).toEqual([null, 'unreads', 'threads', null]);
		expect(ChatUiPlugin.id).toBe('chat');
		expect(ChatUiPlugin.translationNamespace).toBe('CHAT');
		expect(ChatUiPlugin.routes).toEqual([CHAT_PAGE_ROUTE]);
	});

	it('adds the nav entry and the badge once the chat is served, and hides them when it is not', () => {
		const available = new BehaviorSubject<boolean>(false);
		const { injector, nav, header } = injectorWith(available);
		const subscription = registerChatEntryPoints(injector);
		expect(nav.addNavMenuSection).not.toHaveBeenCalled();
		expect(header.registerHeaderAction).not.toHaveBeenCalled();

		available.next(true);
		expect(nav.addNavMenuSection).toHaveBeenCalledTimes(1);
		const [section, before] = nav.addNavMenuSection.mock.calls[0] as [{ id: string; link: string; data: { hide: () => boolean } }, string];
		expect(section.id).toBe(CHAT_NAV_ID);
		expect(section.link).toBe(CHAT_LINK);
		expect(section.data.hide()).toBe(false);
		expect(before).toBe(CHAT_NAV_BEFORE);
		expect(header.registerHeaderAction).toHaveBeenCalledWith(expect.objectContaining({ id: CHAT_HEADER_ACTION_ID }));

		available.next(false);
		expect(nav.addNavMenuSection).toHaveBeenCalledTimes(2);
		expect(section.data.hide()).toBe(true);
		expect(header.removeHeaderAction).toHaveBeenCalledWith(CHAT_HEADER_ACTION_ID);

		subscription.unsubscribe();
	});
});
