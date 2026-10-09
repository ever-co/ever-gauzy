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
import { BehaviorSubject } from 'rxjs';
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

	// A bare injector + `runInInjectionContext` is enough for the service's
	// `inject()` calls and keeps this spec off `TestBed` (which needs the full
	// Angular test environment the ui-core suites deliberately avoid).
	const injector = Injector.create({
		providers: [
			{ provide: Store, useValue: store },
			{ provide: UsersService, useValue: usersService },
			{ provide: Location, useValue: location }
		]
	});
	const service = runInInjectionContext(injector, () => new ChatSidebarService());
	return { service, store, user$, updateUiPreferences };
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
		service.toggleMaximized();
		await flushPersist();
		expect(updateUiPreferences).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalled();
		expect(service.maximized()).toBe(true);
		expect(service.expanded()).toBe(true);
		warn.mockRestore();
	});

	it('maximized is persisted and implies expanded when applied from the server', () => {
		const { service, user$ } = setup();
		service.register(CONFIG);
		user$.next({ id: 'u1', uiPreferences: { aiChat: { expanded: false, maximized: true } } } as any);
		expect(service.maximized()).toBe(true);
		expect(service.expanded()).toBe(true);
	});
});
