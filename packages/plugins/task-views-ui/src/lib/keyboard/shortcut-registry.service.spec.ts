// The ui-core barrel boots half the app (and needs packages this spec does not have): what the service names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	UsersService: class UsersService {},
	QuickActionShortcutBridge: class QuickActionShortcutBridge {},
	QuickActionsPreferencesService: class QuickActionsPreferencesService {}
}));

import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { IUser } from '@gauzy/contracts';
import { QuickActionShortcutBridge, QuickActionsPreferencesService, Store, UsersService } from '@gauzy/ui-core/core';
import { SHORTCUT_SEQUENCE_TIMEOUT_MS } from '../task-views-ui.constants';
import { formatBinding, parseBinding } from './shortcut-registry';
import { keyboardOverridesOf, ShortcutRegistryService } from './shortcut-registry.service';

class StoreStub {
	readonly user$ = new BehaviorSubject<IUser | null>(null);
	get user(): IUser | null {
		return this.user$.value;
	}
	set user(user: IUser | null) {
		this.user$.next(user);
	}
}

const keydown = (code: string, key: string, extra: KeyboardEventInit = {}) =>
	new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true, ...extra });

describe('ShortcutRegistryService', () => {
	let store: StoreStub;
	let users: { updateUiPreferences: jest.Mock };
	let bridge: { run: jest.Mock };
	let quickActions: { setEditing: jest.Mock };
	let registry: ShortcutRegistryService;

	beforeEach(() => {
		store = new StoreStub();
		store.user = {
			id: 'u1',
			uiPreferences: { aiChat: { open: true }, keyboard: { bindings: { goViews: 'g x', paletteOpen: 'mod+p' } } }
		} as unknown as IUser;
		users = { updateUiPreferences: jest.fn() };
		bridge = { run: jest.fn(() => true) };
		quickActions = { setEditing: jest.fn() };
		TestBed.configureTestingModule({
			providers: [
				{ provide: Store, useValue: store },
				{ provide: UsersService, useValue: users },
				{ provide: QuickActionShortcutBridge, useValue: bridge },
				{ provide: QuickActionsPreferencesService, useValue: quickActions }
			]
		});
		registry = TestBed.inject(ShortcutRegistryService);
	});

	afterEach(() => {
		registry.ngOnDestroy();
		jest.useRealTimers();
		document.body.innerHTML = '';
	});

	it('reads the person overrides from their preferences, other clients commands kept', () => {
		expect(registry.overrides()).toEqual({ goViews: 'g x', paletteOpen: 'mod+p' });
		expect(formatBinding(registry.bindingOf('goViews')!)).toBe('g x');
		expect(formatBinding(registry.bindingOf('goTasks')!)).toBe('g t');
		expect(keyboardOverridesOf(null)).toEqual({});
	});

	it('runs a sequence from one listener on the window, before anything else hears the keys', () => {
		const goTasks = jest.fn();
		registry.register('goTasks', { run: goTasks });
		registry.mount();
		const heard = jest.fn();
		document.addEventListener('keydown', heard);
		const first = keydown('KeyG', 'g');
		document.body.dispatchEvent(first);
		expect(first.defaultPrevented).toBe(true);
		document.body.dispatchEvent(keydown('KeyT', 't'));
		expect(goTasks).toHaveBeenCalledWith(expect.objectContaining({ commandId: 'goTasks', extend: false }));
		// The header's Quick Actions (hotkeys-js, on the document) never heard G or T.
		expect(heard).not.toHaveBeenCalled();
		document.removeEventListener('keydown', heard);
	});

	it('leaves keys alone when it is not mounted, in a field, and for a command nobody can run', () => {
		const listDown = jest.fn();
		registry.register('listDown', { run: listDown });
		document.body.dispatchEvent(keydown('KeyJ', 'j'));
		expect(listDown).not.toHaveBeenCalled();
		registry.mount();
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.dispatchEvent(keydown('KeyJ', 'j'));
		expect(listDown).not.toHaveBeenCalled();
		const free = keydown('KeyQ', 'q');
		document.body.dispatchEvent(free);
		expect(free.defaultPrevented).toBe(false);
		document.body.dispatchEvent(keydown('KeyJ', 'j'));
		expect(listDown).toHaveBeenCalledTimes(1);
	});

	it('lets a ⌘/Ctrl chord through from a field (Mod+S saves the view)', () => {
		const save = jest.fn();
		registry.register('listSaveView', { run: save });
		registry.mount();
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.dispatchEvent(keydown('KeyS', 's', { ctrlKey: true }));
		expect(save).toHaveBeenCalled();
	});

	it('runs only enabled handlers, the one registered last first, until it is removed', () => {
		const page = jest.fn();
		const dialog = jest.fn();
		let enabled = false;
		registry.register('listOpen', { run: page });
		const remove = registry.register('listOpen', { run: dialog, enabled: () => enabled });
		registry.mount();
		document.body.dispatchEvent(keydown('Enter', 'Enter'));
		expect(page).toHaveBeenCalledTimes(1);
		enabled = true;
		document.body.dispatchEvent(keydown('Enter', 'Enter'));
		expect(dialog).toHaveBeenCalledTimes(1);
		remove();
		document.body.dispatchEvent(keydown('Enter', 'Enter'));
		expect(page).toHaveBeenCalledTimes(2);
		expect(registry.isRunnable('listOpen')).toBe(true);
	});

	it('runs a command for a button as its keys would, and says when nothing can', () => {
		const help = jest.fn();
		expect(registry.invoke('helpOpen')).toBe(false);
		registry.register('helpOpen', { run: help });
		expect(registry.invoke('helpOpen')).toBe(true);
		expect(help).toHaveBeenCalledWith(expect.objectContaining({ commandId: 'helpOpen', extend: false }));
	});

	it('leaves Enter on a focused button to the button', () => {
		const open = jest.fn();
		registry.register('listOpen', { run: open });
		registry.mount();
		const button = document.createElement('button');
		document.body.appendChild(button);
		const enter = keydown('Enter', 'Enter');
		button.dispatchEvent(enter);
		expect(open).not.toHaveBeenCalled();
		expect(enter.defaultPrevented).toBe(false);
	});

	it('passes Shift beyond a row key as extend', () => {
		const select = jest.fn();
		registry.register('listSelect', { run: select });
		registry.mount();
		document.body.dispatchEvent(keydown('KeyX', 'X', { shiftKey: true }));
		expect(select).toHaveBeenCalledWith(expect.objectContaining({ extend: true }));
	});

	it('keeps to the help while a dialog is open', () => {
		const help = jest.fn();
		const goTasks = jest.fn();
		registry.registerAll({ helpOpen: help, goTasks });
		registry.mount();
		const dialog = document.createElement('nb-dialog-container');
		(dialog as unknown as { getClientRects: () => unknown[] }).getClientRects = () => [{}];
		document.body.appendChild(dialog);
		document.body.dispatchEvent(keydown('KeyG', 'g'));
		document.body.dispatchEvent(keydown('KeyT', 't'));
		expect(goTasks).not.toHaveBeenCalled();
		document.body.dispatchEvent(keydown('Slash', '?', { shiftKey: true }));
		expect(help).toHaveBeenCalled();
	});

	it('gives G back to its Quick Action when no sequence key follows in time', () => {
		jest.useFakeTimers();
		registry.register('goTasks', { run: jest.fn() });
		registry.mount();
		document.body.dispatchEvent(keydown('KeyG', 'g'));
		expect(bridge.run).not.toHaveBeenCalled();
		jest.advanceTimersByTime(SHORTCUT_SEQUENCE_TIMEOUT_MS + 1);
		expect(bridge.run).toHaveBeenCalledWith('g');
	});

	it('drops a sequence when the person moves into a field: the next letter is typed, and no Quick Action runs', () => {
		jest.useFakeTimers();
		const goTasks = jest.fn();
		registry.register('goTasks', { run: goTasks });
		registry.mount();
		document.body.dispatchEvent(keydown('KeyG', 'g'));
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();
		const typed = keydown('KeyT', 't');
		input.dispatchEvent(typed);
		expect(goTasks).not.toHaveBeenCalled();
		expect(typed.defaultPrevented).toBe(false);
		jest.advanceTimersByTime(SHORTCUT_SEQUENCE_TIMEOUT_MS + 1);
		expect(bridge.run).not.toHaveBeenCalled();
	});

	it('runs no Quick Action when the wait ends in a field', () => {
		jest.useFakeTimers();
		registry.register('goTasks', { run: jest.fn() });
		registry.mount();
		document.body.dispatchEvent(keydown('KeyG', 'g'));
		const input = document.createElement('input');
		document.body.appendChild(input);
		input.focus();
		jest.advanceTimersByTime(SHORTCUT_SEQUENCE_TIMEOUT_MS + 1);
		expect(bridge.run).not.toHaveBeenCalled();
	});

	it('gives G back when the next key starts no sequence, and reads that key on its own', () => {
		const listDown = jest.fn();
		registry.registerAll({ goTasks: jest.fn(), listDown });
		registry.mount();
		document.body.dispatchEvent(keydown('KeyG', 'g'));
		document.body.dispatchEvent(keydown('KeyJ', 'j'));
		expect(bridge.run).toHaveBeenCalledWith('g');
		expect(listDown).toHaveBeenCalledTimes(1);
	});

	it('runs nothing while paused (a binding being recorded), and pauses the Quick Actions with it', () => {
		const goTasks = jest.fn();
		registry.register('goTasks', { run: goTasks });
		registry.mount();
		registry.setPaused(true);
		expect(quickActions.setEditing).toHaveBeenCalledWith(true);
		document.body.dispatchEvent(keydown('KeyG', 'g'));
		document.body.dispatchEvent(keydown('KeyT', 't'));
		expect(goTasks).not.toHaveBeenCalled();
		registry.setPaused(false);
		expect(quickActions.setEditing).toHaveBeenLastCalledWith(false);
	});

	it('saves a binding into the keyboard preferences, keeping the other clients overrides, and follows it at once', async () => {
		users.updateUiPreferences.mockResolvedValue({
			aiChat: { open: true },
			keyboard: { bindings: { goViews: 'g x', paletteOpen: 'mod+p', goTasks: 'g y' } }
		});
		await registry.saveBinding('goTasks', parseBinding('g y'));
		expect(users.updateUiPreferences).toHaveBeenCalledWith({
			keyboard: { bindings: { goViews: 'g x', paletteOpen: 'mod+p', goTasks: 'g y' } }
		});
		expect(formatBinding(registry.bindingOf('goTasks')!)).toBe('g y');
		expect((store.user!.uiPreferences as Record<string, unknown>)['aiChat']).toEqual({ open: true });
	});

	it('restores every default of its own commands, leaving another client overrides', async () => {
		users.updateUiPreferences.mockResolvedValue(undefined);
		await registry.resetAll();
		expect(users.updateUiPreferences).toHaveBeenCalledWith({ keyboard: { bindings: { paletteOpen: 'mod+p' } } });
		expect(registry.overrides()).toEqual({ paletteOpen: 'mod+p' });
	});

	it('never rebinds a fixed command, and changes nothing when the save fails', async () => {
		await registry.saveBinding('listOpen', parseBinding('o'));
		expect(users.updateUiPreferences).not.toHaveBeenCalled();
		users.updateUiPreferences.mockRejectedValue(new Error('offline'));
		await expect(registry.saveBinding('goTasks', parseBinding('g y'))).rejects.toThrow('offline');
		expect(formatBinding(registry.bindingOf('goTasks')!)).toBe('g t');
	});
});
