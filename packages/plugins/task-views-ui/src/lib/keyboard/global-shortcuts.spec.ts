// The ui-core barrel boots half the app (and needs packages this spec does not have): what the registry names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	UsersService: class UsersService {},
	QuickActionShortcutBridge: class QuickActionShortcutBridge {},
	QuickActionsPreferencesService: class QuickActionsPreferencesService {}
}));

import { Type } from '@angular/core';
import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { GlobalDialogLoaders, registerGlobalShortcuts } from './global-shortcuts';
import { ShortcutRegistryService } from './shortcut-registry.service';

class HelpDialog {}
class GoToDialog {}

function setUp() {
	const handlers: Record<string, () => void> = {};
	const removeAll = jest.fn();
	const registry = {
		registerAll: jest.fn((registered: Record<string, () => void>) => {
			Object.assign(handlers, registered);
			return removeAll;
		})
	};
	const opened: Array<{ component: unknown; close: jest.Mock; onClose: Subject<void> }> = [];
	const dialogs = {
		open: jest.fn((component: unknown) => {
			const onClose = new Subject<void>();
			const ref = { component, onClose, close: jest.fn(() => onClose.next()) };
			opened.push(ref);
			return ref;
		})
	};
	// Each dialog's code arrives when the spec says so.
	const arrivals: Partial<Record<'help' | 'goTo', (component: Type<unknown>) => void>> = {};
	const loaders: GlobalDialogLoaders = {
		help: () => new Promise((resolve) => (arrivals.help = resolve)),
		goTo: () => new Promise((resolve) => (arrivals.goTo = resolve))
	};
	const services = new Map<unknown, unknown>([
		[ShortcutRegistryService, registry],
		[Router, { navigateByUrl: jest.fn() }],
		[NbDialogService, dialogs]
	]);
	const remove = registerGlobalShortcuts({ get: (token: unknown) => services.get(token) } as never, loaders);
	return { handlers, remove, removeAll, dialogs, opened, arrivals };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('registerGlobalShortcuts', () => {
	it('opens a dialog once while its code loads, and `?` closes the help again', async () => {
		const { handlers, dialogs, opened, arrivals } = setUp();
		handlers['helpOpen']();
		handlers['helpOpen']();
		arrivals.help?.(HelpDialog);
		await settle();
		expect(dialogs.open).toHaveBeenCalledTimes(1);
		expect(opened[0].component).toBe(HelpDialog);
		handlers['helpOpen']();
		expect(opened[0].close).toHaveBeenCalled();
	});

	it('opens no dialog whose code arrives after the shortcuts went away', async () => {
		const { handlers, remove, removeAll, dialogs, arrivals } = setUp();
		handlers['taskGoTo']();
		remove();
		expect(removeAll).toHaveBeenCalled();
		arrivals.goTo?.(GoToDialog);
		await settle();
		expect(dialogs.open).not.toHaveBeenCalled();
	});

	it('closes the dialogs it opened when the shortcuts go away', async () => {
		const { handlers, remove, opened, arrivals } = setUp();
		handlers['taskGoTo']();
		arrivals.goTo?.(GoToDialog);
		await settle();
		expect(opened).toHaveLength(1);
		remove();
		expect(opened[0].close).toHaveBeenCalled();
	});
});
