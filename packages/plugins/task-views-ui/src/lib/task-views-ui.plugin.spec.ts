// The ui-core barrel boots half the app (and needs packages this spec does not have): what the plugin names from it is doubled.
jest.mock('@gauzy/ui-core/core', () => ({
	NavMenuBuilderService: class NavMenuBuilderService {},
	PermissionsGuard: class PermissionsGuard {},
	Store: class Store {},
	ToastrService: class ToastrService {},
	UsersService: class UsersService {},
	QuickActionShortcutBridge: class QuickActionShortcutBridge {},
	QuickActionsPreferencesService: class QuickActionsPreferencesService {}
}));

import { Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { Subject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { PAGE_EXTENSION_SLOTS } from '@gauzy/plugin-ui';
import { NavMenuBuilderService } from '@gauzy/ui-core/core';
import { GO_TO_LINKS } from './keyboard/global-shortcuts';
import { SHORTCUT_COMMANDS } from './keyboard/shortcut-registry';
import { ShortcutRegistryService } from './keyboard/shortcut-registry.service';
import { TaskViewsAvailabilityService } from './services/task-views-availability.service';
import {
	KEYBOARD_SETTINGS_NAV_ID,
	SETTINGS_NAV_SECTION_ID,
	TASK_VIEW_ACTIONS_SLOT,
	TASK_VIEWS_NAV_ID,
	TASK_VIEWS_NAV_SECTION_ID
} from './task-views-ui.constants';
import {
	KEYBOARD_SETTINGS_ROUTE,
	registerTaskViewsEntryPoints,
	TASK_REFERENCE_EXTENSION,
	TASK_VIEWS_CHILD_ROUTES,
	TASK_VIEWS_PAGE_ROUTE,
	TaskViewsUiPlugin
} from './task-views-ui.plugin';
import en from '../i18n/en.json';

function injectorWith(available$: Subject<boolean>) {
	const nav = { addNavMenuItems: jest.fn() };
	const registry = { mount: jest.fn(), unmount: jest.fn(), registerAll: jest.fn(() => removeAll) };
	const removeAll = jest.fn();
	const router = { navigateByUrl: jest.fn() };
	const dialogs = { open: jest.fn() };
	const services = new Map<unknown, unknown>([
		[TaskViewsAvailabilityService, { available$ }],
		[NavMenuBuilderService, nav],
		[ShortcutRegistryService, registry],
		[Router, router],
		[NbDialogService, dialogs]
	]);
	return { injector: { get: (token: unknown) => services.get(token) } as never, nav, registry, removeAll, router };
}

describe('TaskViewsUiPlugin', () => {
	it('serves the page, its built-in and saved views, and Settings > Keyboard shortcuts', () => {
		expect(TASK_VIEWS_PAGE_ROUTE).toMatchObject({ location: 'page-sections', path: 'task-views' });
		expect((TASK_VIEWS_PAGE_ROUTE.data?.['permissions'] as { only: PermissionsEnum[] }).only).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.ORG_TASK_VIEW
		]);
		expect(TASK_VIEWS_CHILD_ROUTES.map((route) => route.path)).toEqual(['', 'built-in/:key', ':viewId']);
		expect(KEYBOARD_SETTINGS_ROUTE).toMatchObject({ location: 'settings-sections', path: 'keyboard-shortcuts' });
		expect(TaskViewsUiPlugin.extensions).toEqual([TASK_REFERENCE_EXTENSION]);
		expect(TASK_VIEW_ACTIONS_SLOT).toBe(PAGE_EXTENSION_SLOTS.TASK_VIEW_ACTIONS);
	});

	it('shows nothing and listens to no key until the API serves the task views', () => {
		const available$ = new Subject<boolean>();
		const { injector, nav, registry } = injectorWith(available$);
		registerTaskViewsEntryPoints(injector);
		available$.next(false);
		expect(nav.addNavMenuItems).not.toHaveBeenCalled();
		expect(registry.mount).not.toHaveBeenCalled();
	});

	it('adds the entries and mounts the shortcuts once served, and hides and unmounts them when that ends', () => {
		const available$ = new Subject<boolean>();
		const { injector, nav, registry, removeAll } = injectorWith(available$);
		registerTaskViewsEntryPoints(injector);
		available$.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledWith(
			[expect.objectContaining({ id: TASK_VIEWS_NAV_ID })],
			TASK_VIEWS_NAV_SECTION_ID
		);
		expect(nav.addNavMenuItems).toHaveBeenCalledWith(
			[expect.objectContaining({ id: KEYBOARD_SETTINGS_NAV_ID })],
			SETTINGS_NAV_SECTION_ID
		);
		const [[[item]]] = nav.addNavMenuItems.mock.calls as unknown as [[[{ data: { hide: () => boolean } }]]];
		expect(item.data.hide()).toBe(false);
		expect(registry.mount).toHaveBeenCalledTimes(1);
		expect(registry.registerAll).toHaveBeenCalledTimes(1);

		available$.next(false);
		expect(item.data.hide()).toBe(true);
		expect(removeAll).toHaveBeenCalled();
		expect(registry.unmount).toHaveBeenCalledTimes(1);
	});

	it('registers a handler for every global command', () => {
		const available$ = new Subject<boolean>();
		const { injector, registry, router } = injectorWith(available$);
		registerTaskViewsEntryPoints(injector);
		available$.next(true);
		const handlers = (registry.registerAll.mock.calls as unknown as [[Record<string, () => void>]])[0][0];
		const globals = SHORTCUT_COMMANDS.filter((command) => command.context === 'global').map(
			(command) => command.id
		);
		expect(Object.keys(handlers).sort()).toEqual([...globals].sort());
		handlers['goMine']();
		expect(router.navigateByUrl).toHaveBeenCalledWith(GO_TO_LINKS['goMine']);
	});

	it('names every command and context in English', () => {
		const commands = (en as { SHORTCUTS: { COMMANDS: Record<string, string> } }).SHORTCUTS.COMMANDS;
		for (const command of SHORTCUT_COMMANDS) expect(commands[command.id]).toBeTruthy();
	});
});
