/**
 * The service injects `Store` and `UsersService` by token only. Both modules are replaced with empty
 * classes so the spec never loads the Akita store or the HTTP layer; the tokens are then satisfied by
 * the doubles registered on the injector (same approach as the chat-sidebar spec).
 */
jest.mock('../store/store.service', () => ({ Store: class Store {} }));
jest.mock('../users/users.service', () => ({ UsersService: class UsersService {} }));

import { Injector, runInInjectionContext } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { IUser, IUserUiPreferences } from '@gauzy/contracts';
import { Store } from '../store/store.service';
import { UsersService } from '../users/users.service';
import { QUICK_ACTION_DEFINITIONS } from './quick-action.definitions';
import { normalizeShortcut } from './quick-action-shortcut.util';
import { QuickActionsPreferencesService } from './quick-actions-preferences.service';

const user = (id: string, uiPreferences?: IUserUiPreferences): IUser => ({ id, uiPreferences }) as IUser;

/** The server's shallow merge: a `null` feature is removed. */
function serverMerge(current: IUserUiPreferences | undefined, patch: Record<string, unknown>): IUserUiPreferences {
	const merged: Record<string, unknown> = { ...(current ?? {}) };
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) {
			delete merged[key];
		} else {
			merged[key] = value;
		}
	}
	return merged as IUserUiPreferences;
}

/** Wires a fresh service against a Store double and a recording UsersService double. */
function setup(initial: IUser | null = user('u1')) {
	const user$ = new BehaviorSubject<IUser | null>(initial);
	const store = {
		user$,
		get user() {
			return user$.getValue();
		},
		set user(value: IUser | null) {
			user$.next(value);
		}
	};
	const updateUiPreferences = jest.fn(async (patch: Record<string, unknown>) =>
		serverMerge(store.user?.uiPreferences, patch)
	);
	const injector = Injector.create({
		providers: [
			{ provide: Store, useValue: store },
			{ provide: UsersService, useValue: { updateUiPreferences } }
		]
	});
	const service = runInInjectionContext(injector, () => new QuickActionsPreferencesService());
	return { service, store, user$, updateUiPreferences };
}

/** Collects what an observable emits. */
function record<T>(source: { subscribe: (next: (value: T) => void) => unknown }): T[] {
	const values: T[] = [];
	source.subscribe((value) => values.push(value));
	return values;
}

describe('QuickActionsPreferencesService', () => {
	it('is not editing by default', () => {
		expect(setup().service.editing()).toBe(false);
	});

	describe('reading', () => {
		it('gives null (the defaults) for a user who never customized anything', () => {
			const { service } = setup(user('u1', { chatSidebar: { expanded: true } } as IUserUiPreferences));
			expect(record(service.preferences$)).toEqual([null]);
			expect(service.preferences).toBeNull();
		});

		it('gives null when nobody is signed in', () => {
			const { service } = setup(null);
			expect(record(service.preferences$)).toEqual([null]);
			expect(service.preferences).toBeNull();
		});

		it('sanitizes what is stored', () => {
			const { service } = setup(
				user('u1', { quickActions: { order: ['gone', 'viewTasks'], shortcuts: { createTask: 'Shift+Y' } } })
			);
			expect(service.preferences).toEqual({ order: ['viewTasks'], shortcuts: { createTask: 'shift+y' } });
		});

		it('emits only when the customization changes', () => {
			const { service, store } = setup(user('u1', { quickActions: { shortcuts: { createTask: 'y' } } }));
			const emitted = record(service.preferences$);
			store.user = { ...store.user, firstName: 'Renamed' } as IUser;
			store.user = user('u1', { quickActions: { shortcuts: { createTask: 'Y' } } });
			store.user = user('u1', { quickActions: { shortcuts: { createTask: 'z' } } });
			expect(emitted).toEqual([{ shortcuts: { createTask: 'y' } }, { shortcuts: { createTask: 'z' } }]);
		});

		it('resolves the effective shortcuts', () => {
			const { service, store } = setup();
			const emitted = record(service.shortcuts$);
			expect(emitted[0]).toEqual(
				Object.fromEntries(
					QUICK_ACTION_DEFINITIONS.map(({ id, shortcut }) => [id, normalizeShortcut(shortcut)])
				)
			);

			store.user = user('u1', { quickActions: { shortcuts: { createTask: 'i' } } });
			expect(emitted).toHaveLength(2);
			expect(emitted[1]['createTask']).toBe('i');
			expect(emitted[1]['createInvoice']).toBe('');
		});
	});

	describe('saving', () => {
		it('sends the customization and stores the merged preferences', async () => {
			const { service, store, updateUiPreferences } = setup(
				user('u1', { chatSidebar: { expanded: false } } as IUserUiPreferences)
			);
			await service.save({ shortcuts: { createTask: 'y' } });

			expect(updateUiPreferences).toHaveBeenCalledWith({ quickActions: { shortcuts: { createTask: 'y' } } });
			expect(store.user.uiPreferences).toEqual({
				chatSidebar: { expanded: false },
				quickActions: { shortcuts: { createTask: 'y' } }
			});
			expect(service.preferences).toEqual({ shortcuts: { createTask: 'y' } });
		});

		it('removes the customization on reset', async () => {
			const { service, store, updateUiPreferences } = setup(
				user('u1', {
					quickActions: { order: ['viewTasks'] },
					chatSidebar: { expanded: true }
				} as IUserUiPreferences)
			);
			await service.reset();

			expect(updateUiPreferences).toHaveBeenCalledWith({ quickActions: null });
			expect(store.user.uiPreferences).toEqual({ chatSidebar: { expanded: true } });
			expect(service.preferences).toBeNull();
		});

		it('merges locally when the server answers nothing usable', async () => {
			const { service, store, updateUiPreferences } = setup(
				user('u1', {
					quickActions: { order: ['viewTasks'] },
					chatSidebar: { expanded: true }
				} as IUserUiPreferences)
			);
			updateUiPreferences.mockResolvedValueOnce(undefined);
			await service.save({ shortcuts: { createTask: 'y' } });
			expect(store.user.uiPreferences).toEqual({
				chatSidebar: { expanded: true },
				quickActions: { shortcuts: { createTask: 'y' } }
			});

			updateUiPreferences.mockResolvedValueOnce([] as unknown as IUserUiPreferences);
			await service.save(null);
			expect(store.user.uiPreferences).toEqual({ chatSidebar: { expanded: true } });
		});

		it('rejects and changes nothing when the request fails', async () => {
			const before = user('u1', { quickActions: { order: ['viewTasks'] } });
			const { service, store, updateUiPreferences } = setup(before);
			updateUiPreferences.mockRejectedValueOnce(new Error('offline'));

			await expect(service.save(null)).rejects.toThrow('offline');
			expect(store.user).toBe(before);
		});

		it('does not write another user’s preferences when the user changed meanwhile', async () => {
			const { service, store, updateUiPreferences } = setup(user('u1'));
			let answer: (value: IUserUiPreferences) => void;
			updateUiPreferences.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));

			const saving = service.save({ shortcuts: { createTask: 'y' } });
			const other = user('u2');
			store.user = other;
			answer({ quickActions: { shortcuts: { createTask: 'y' } } });
			await saving;

			expect(store.user).toBe(other);
		});

		it('does nothing when nobody is signed in', async () => {
			const { service, store, updateUiPreferences } = setup(null);
			await service.save({ shortcuts: { createTask: 'y' } });
			expect(updateUiPreferences).not.toHaveBeenCalled();
			expect(store.user).toBeNull();
		});
	});
});
