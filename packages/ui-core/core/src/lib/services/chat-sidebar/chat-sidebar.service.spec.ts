/**
 * The service injects `Store` and `UsersService` by token only. Both modules are
 * replaced with empty classes so the spec never loads the Akita store or the
 * HTTP layer (the `Store` module reaches into the `@gauzy/ui-core/common`
 * barrel); the tokens are then satisfied by the mocks registered on the injector.
 */
jest.mock('../store/store.service', () => ({ Store: class Store {} }));
jest.mock('../users/users.service', () => ({ UsersService: class UsersService {} }));

import { Injector, runInInjectionContext } from '@angular/core';
import { Location } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { IUser } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { UsersService } from '../users/users.service';
import { ChatSidebarService, MAX_CHAT_WIDTH } from './chat-sidebar.service';

interface StoreMock {
	user$: BehaviorSubject<IUser | null>;
	user: IUser | null;
}

/** Wires a fresh service against a Store double and a recording UsersService double. */
function setup() {
	const user$ = new BehaviorSubject<IUser | null>(null);
	const store: StoreMock = {
		user$,
		get user() {
			return user$.getValue();
		},
		set user(value: IUser | null) {
			user$.next(value);
		}
	};
	const updateUiPreferences = jest.fn(async (patch: any) => ({ ...(store.user?.uiPreferences ?? {}), ...patch }));
	const usersService = { updateUiPreferences };
	const location = { prepareExternalUrl: (path: string) => path };
	const events = new Subject<unknown>();
	const router = {
		url: '/pages/tasks?view=board',
		events,
		navigateByUrl: jest.fn(async (_url: string) => true),
		/** Simulate a finished navigation to `url`. */
		navigated(url: string) {
			this.url = url;
			events.next(new NavigationEnd(1, url, url));
		}
	};

	// A bare injector + `runInInjectionContext` is enough for the service's
	// `inject()` calls and keeps this spec off `TestBed` (which needs the full
	// Angular test environment the ui-core suites deliberately avoid).
	const injector = Injector.create({
		providers: [
			{ provide: Store, useValue: store },
			{ provide: UsersService, useValue: usersService },
			{ provide: Location, useValue: location },
			{ provide: Router, useValue: router }
		]
	});
	const service = runInInjectionContext(injector, () => new ChatSidebarService());
	return { service, store, user$, updateUiPreferences, router };
}

const CONFIG = { loadComponent: () => class {} as any, defaultExpanded: true };

/** Advance the persist debounce (600 ms) and let the resulting promise chain settle. */
async function flushPersist(): Promise<void> {
	jest.advanceTimersByTime(700);
	// The write is `await`ed inside a `setTimeout` callback — drain the microtasks it queues.
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
}

describe('ChatSidebarService — persisted state precedence and server sync', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		localStorage.clear();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('uses the config default (expanded) when neither server nor local state exists', () => {
		const { service } = setup();
		service.register(CONFIG);
		expect(service.expanded()).toBe(true);
		expect(service.position()).toBe('start');
		expect(service.width()).toBe(384);
		expect(service.maximized()).toBe(false);
	});

	it('local mirror beats the default: legacy un-keyed keys are honoured before a user is known', () => {
		localStorage.setItem('gauzy_chat_sidebar_expanded', 'false');
		localStorage.setItem('gauzy_chat_sidebar_position', 'end');
		localStorage.setItem('gauzy_chat_sidebar_width', '500');
		const { service } = setup();
		service.register(CONFIG);
		expect(service.expanded()).toBe(false);
		expect(service.position()).toBe('end');
		expect(service.width()).toBe(500);
	});

	it('server state beats the local mirror once the user arrives (and mirrors it per user)', () => {
		localStorage.setItem('gauzy_chat_sidebar_expanded', 'false');
		localStorage.setItem('gauzy_chat_sidebar_position', 'end');
		const { service, user$ } = setup();
		service.register(CONFIG);
		expect(service.expanded()).toBe(false);

		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: true, position: 'start', width: 420 } } } as any);

		expect(service.expanded()).toBe(true);
		expect(service.position()).toBe('start');
		expect(service.width()).toBe(420);
		expect(localStorage.getItem('gauzy_chat_sidebar_u1_expanded')).toBe('true');
		expect(localStorage.getItem('gauzy_chat_sidebar_u1_width')).toBe('420');
	});

	it('falls back per field: a partial server object fills the rest from local, then default', () => {
		localStorage.setItem('gauzy_chat_sidebar_u1_width', '600');
		const { service, user$ } = setup();
		service.register(CONFIG);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { position: 'end' } } } as any);
		expect(service.position()).toBe('end'); // server
		expect(service.width()).toBe(600); // local (per-user key)
		expect(service.expanded()).toBe(true); // default
	});

	it('ignores invalid server values (out-of-range width, unknown position)', () => {
		const { service, user$ } = setup();
		service.register(CONFIG);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { width: MAX_CHAT_WIDTH + 1, position: 'left' } } } as any);
		expect(service.width()).toBe(384);
		expect(service.position()).toBe('start');
	});

	it('applies the state even when the user is known BEFORE register()', () => {
		const { service, user$ } = setup();
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: false } } } as any);
		service.register(CONFIG);
		expect(service.expanded()).toBe(false);
	});

	it('re-applies from the other user on a user switch and never leaks the previous local values', () => {
		const { service, user$ } = setup();
		service.register(CONFIG);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: false, position: 'end' } } } as any);
		expect(service.expanded()).toBe(false);

		// u2 has no server state and no local mirror → defaults, not u1's values.
		user$.next({ id: 'u2' } as any);
		expect(service.expanded()).toBe(true);
		expect(service.position()).toBe('start');
		expect(localStorage.getItem('gauzy_chat_sidebar_u1_position')).toBe('end');
		expect(localStorage.getItem('gauzy_chat_sidebar_u2_position')).toBe('start');
	});

	it('writes to the server (debounced, once) after a user-driven change and mirrors the merged result into Store.user', async () => {
		const { service, user$, updateUiPreferences, store } = setup();
		service.register(CONFIG);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: true } } } as any);

		service.collapse();
		service.setPosition('end');
		expect(updateUiPreferences).not.toHaveBeenCalled();

		await flushPersist();

		expect(updateUiPreferences).toHaveBeenCalledTimes(1);
		expect(updateUiPreferences).toHaveBeenCalledWith({
			aiChat: { expanded: false, position: 'end', width: 384, maximized: false }
		});
		expect(store.user?.uiPreferences?.aiChat).toEqual({
			expanded: false,
			position: 'end',
			width: 384,
			maximized: false
		});
		// The mirrored Store emission must not revert the panel.
		expect(service.expanded()).toBe(false);
		expect(service.position()).toBe('end');
	});

	it('keeps another feature’s preferences saved while its write was in flight', async () => {
		const { service, user$, updateUiPreferences, store } = setup();
		service.register(CONFIG);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: true } } } as any);
		let answer: (value: any) => void;
		updateUiPreferences.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

		service.collapse();
		await flushPersist();
		expect(updateUiPreferences).toHaveBeenCalledTimes(1);

		// The Quick Actions save lands meanwhile; the server's answer to the panel's write predates it.
		store.user = {
			...store.user,
			uiPreferences: { ...store.user.uiPreferences, quickActions: { shortcuts: { createTask: 'y' } } }
		} as any;
		const saved = { expanded: false, position: 'start', width: 384, maximized: false };
		answer({ aiChat: saved });
		for (let i = 0; i < 5; i++) {
			await Promise.resolve();
		}

		expect(store.user?.uiPreferences).toEqual({
			aiChat: saved,
			quickActions: { shortcuts: { createTask: 'y' } }
		});
		expect(service.expanded()).toBe(false);
	});

	it('does not write when nothing changed against the known server state', async () => {
		const { service, user$, updateUiPreferences } = setup();
		service.register(CONFIG);
		user$.next({
			id: 'u1',
			uiPreferences: { aiChat: { expanded: true, position: 'start', width: 384, maximized: false } }
		} as any);
		service.expand(); // already expanded
		await flushPersist();
		expect(updateUiPreferences).not.toHaveBeenCalled();
	});

	it('does not write before a user is known, and drops a pending write on user switch', async () => {
		const { service, user$, updateUiPreferences } = setup();
		service.register(CONFIG);
		service.collapse();
		await flushPersist();
		expect(updateUiPreferences).not.toHaveBeenCalled();

		user$.next({ id: 'u1' } as any);
		service.setPosition('end');
		user$.next({ id: 'u2' } as any); // switch before the debounce fires
		await flushPersist();
		expect(updateUiPreferences).not.toHaveBeenCalled();
	});

	it('swallows and logs a failed write', async () => {
		const { service, user$, updateUiPreferences } = setup();
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		updateUiPreferences.mockRejectedValueOnce(new Error('boom'));
		service.register(CONFIG);
		user$.next({ id: 'u1' } as any);
		service.setPosition('end');
		await flushPersist();
		expect(updateUiPreferences).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalled();
		expect(service.position()).toBe('end');
		warn.mockRestore();
	});

	it('maximized is persisted and implies expanded when applied from the server', () => {
		const { service, user$, router } = setup();
		service.register(CONFIG);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: false, maximized: true } } } as any);
		expect(service.maximized()).toBe(true);
		expect(service.expanded()).toBe(true);
		expect(localStorage.getItem('gauzy_chat_sidebar_u1_maximized')).toBe('true');
		expect(router.navigateByUrl).not.toHaveBeenCalled();

		// Applied before the page is known: the first navigation adopts it, the next one away restores.
		router.navigated('/pages/tasks');
		expect(service.maximized()).toBe(true);
		router.navigated('/pages/organization/projects');
		expect(service.maximized()).toBe(false);
	});

	it('a maximize that preferences apply after a page has loaded covers that page, and leaving it restores', () => {
		const { service, user$, router } = setup();
		service.register(CONFIG);
		router.navigated('/pages/tasks');

		// Preferences that maximize the chat arrive between two completed navigations (another tab or device)
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: true, maximized: true } } } as any);
		expect(service.maximized()).toBe(true);

		// The page it was applied over is the one it covers: opening another one shows that page
		router.navigated('/pages/organization/projects');
		expect(service.maximized()).toBe(false);
	});

	it('a saved maximize applied at sign-in survives the redirect into the app', () => {
		const { service, user$, router } = setup();
		service.register(CONFIG);
		// The sign-in page has loaded, then sign-in writes the user (and its saved maximize)
		router.navigated('/auth/login');
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: true, maximized: true } } } as any);
		expect(service.maximized()).toBe(true);

		// The redirect into the app is not a navigation away from a maximized page: it adopts the maximize
		router.navigated('/pages/dashboard');
		expect(service.maximized()).toBe(true);
		expect(localStorage.getItem('gauzy_chat_sidebar_u1_maximized')).toBe('true');

		// Leaving that app page then restores, as for any maximize
		router.navigated('/pages/organization/projects');
		expect(service.maximized()).toBe(false);
	});
});

describe('ChatSidebarService — Maximize / Restore', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		localStorage.clear();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('Maximize expands the chat in place and never navigates, so the page underneath stays alive', () => {
		const { service, router } = setup();
		service.register(CONFIG);
		service.toggleMaximized();
		expect(service.maximized()).toBe(true);
		expect(router.navigateByUrl).not.toHaveBeenCalled();

		service.toggleMaximized(); // Restore
		expect(service.maximized()).toBe(false);
		expect(service.expanded()).toBe(true);
		expect(router.navigateByUrl).not.toHaveBeenCalled();
	});

	it('Maximize from a closed panel marks it expanded, so Restore shows the docked chat', () => {
		const { service } = setup();
		service.register({ ...CONFIG, defaultExpanded: false });
		expect(service.expanded()).toBe(false);
		service.maximize();
		expect(service.expanded()).toBe(true);
	});

	it('Close while maximized hands the screen back to the page with the chat closed', () => {
		const { service, router } = setup();
		service.register(CONFIG);
		service.maximize();
		service.collapse();
		expect(service.maximized()).toBe(false);
		expect(service.expanded()).toBe(false);
		expect(router.navigateByUrl).not.toHaveBeenCalled();
	});

	it('a navigation to another page while maximized restores the docked chat', () => {
		const { service, router } = setup();
		service.register(CONFIG);
		service.maximize();

		router.navigated('/pages/tasks?view=list'); // same page, new query: stays maximized
		expect(service.maximized()).toBe(true);

		router.navigated('/pages/organization/projects'); // the assistant opened a page
		expect(service.maximized()).toBe(false);
		expect(service.expanded()).toBe(true);
	});

	it('the full-page chat route counts as maximized, and Restore / Close leave it', () => {
		const { service, router } = setup();
		service.register(CONFIG);
		service.setFullPageOpen(true); // e.g. a bookmark of /pages/ai-chat
		expect(service.maximized()).toBe(true);
		expect(service.fullPageOpen()).toBe(true);

		service.restore();
		expect(router.navigateByUrl).toHaveBeenLastCalledWith('/pages/dashboard');

		service.collapse();
		expect(router.navigateByUrl).toHaveBeenCalledTimes(2);

		service.setFullPageOpen(false); // the route was left
		expect(service.maximized()).toBe(false);
		expect(service.fullPageOpen()).toBe(false);
	});

	it('preferences that close the chat end an in-place maximize, but not the full-page route', () => {
		const { service, user$ } = setup();
		service.register(CONFIG);
		user$.next({ id: 'u1' } as any);

		service.maximize();
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: false } } } as any); // another tab
		expect(service.expanded()).toBe(false);
		expect(service.maximized()).toBe(false);

		service.setFullPageOpen(true);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: true } } } as any);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: false } } } as any);
		expect(service.maximized()).toBe(true); // the route page is the chat
	});

	it('the docked chat leaving the screen (unavailable, unregistered) ends an in-place maximize', () => {
		const { service } = setup();
		service.register(CONFIG);
		service.setAvailable(true);

		service.maximize();
		service.setAvailable(false); // e.g. the "Enable AI Chat" setting switched off, a permission lost
		expect(service.maximized()).toBe(false);

		service.setAvailable(true);
		service.maximize();
		service.unregister();
		expect(service.maximized()).toBe(false);
	});

	it('losing availability leaves the full-page route as it is: that page is the chat', () => {
		const { service } = setup();
		service.register(CONFIG);
		service.setFullPageOpen(true);
		service.setAvailable(false);
		expect(service.maximized()).toBe(true);
	});

	it('Maximize and Restore are persisted', async () => {
		const { service, user$, updateUiPreferences } = setup();
		service.register({ ...CONFIG, defaultExpanded: false });
		user$.next({ id: 'u1' } as any);
		service.maximize();
		await flushPersist();
		expect(updateUiPreferences).toHaveBeenLastCalledWith({
			aiChat: { expanded: true, position: 'start', width: 384, maximized: true }
		});

		service.restore();
		await flushPersist();
		expect(updateUiPreferences).toHaveBeenLastCalledWith({
			aiChat: { expanded: true, position: 'start', width: 384, maximized: false }
		});
	});

	it('the full-page chat route is never persisted as maximized', async () => {
		const { service, user$, updateUiPreferences } = setup();
		service.register({ ...CONFIG, defaultExpanded: false });
		user$.next({ id: 'u1' } as any);
		service.setFullPageOpen(true);
		service.setPosition('end');
		await flushPersist();
		expect(updateUiPreferences).toHaveBeenLastCalledWith({
			aiChat: { expanded: false, position: 'end', width: 384, maximized: false }
		});
	});
});
