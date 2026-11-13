// `@gauzy/ui-core/core` is replaced at the module boundary: its barrel boots the app's whole service graph, and this
// suite needs only the classes as injection tokens.
jest.mock('@gauzy/ui-core/core', () => ({
	Store: class Store {},
	ToastrService: class ToastrService {},
	NavMenuBuilderService: class NavMenuBuilderService {},
	PermissionsGuard: class PermissionsGuard {}
}));

import { Injector } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { NavMenuBuilderService } from '@gauzy/ui-core/core';
import { TASK_AUTOMATIONS_NAV_ID, TASK_AUTOMATIONS_SETTINGS_LINK } from './task-automations-ui.constants';
import {
	registerTaskAutomationsEntryPoints,
	TASK_AUTOMATIONS_SETTINGS_ROUTE,
	TaskAutomationsUiPlugin
} from './task-automations-ui.plugin';
import { TaskAutomationsAvailabilityService } from './services/task-automations-availability.service';

/** The plugin: the route always; the Settings entry only where the API serves task automations. */
describe('TaskAutomationsUiPlugin', () => {
	function injectorWith(available: BehaviorSubject<boolean | null>) {
		const nav = { addNavMenuItems: jest.fn() };
		const injector = Injector.create({
			providers: [
				{ provide: NavMenuBuilderService, useValue: nav },
				{ provide: TaskAutomationsAvailabilityService, useValue: { available$: available.pipe() } }
			]
		});
		return { injector, nav };
	}

	it('declares Settings → Automations behind TASK_AUTOMATION_MANAGE, with its translations', () => {
		expect(TaskAutomationsUiPlugin.id).toBe('task-automations');
		expect(TaskAutomationsUiPlugin.routes).toEqual([TASK_AUTOMATIONS_SETTINGS_ROUTE]);
		expect(TASK_AUTOMATIONS_SETTINGS_ROUTE).toMatchObject({
			location: 'settings-sections',
			path: 'automations',
			data: { permissions: { only: [PermissionsEnum.TASK_AUTOMATION_MANAGE], redirectTo: '/pages/settings' } }
		});
		expect(TaskAutomationsUiPlugin.translationNamespace).toBe('TASK_AUTOMATIONS');
		expect(TaskAutomationsUiPlugin.translations?.['en']).toHaveProperty('MENU', 'Automations');
		expect(typeof TaskAutomationsUiPlugin.bootstrap).toBe('function');
	});

	it('loads the page component on first visit', async () => {
		const route = TASK_AUTOMATIONS_SETTINGS_ROUTE as { loadComponent: () => Promise<unknown> };
		const component = await route.loadComponent();
		expect((component as { name: string }).name).toBe('TaskAutomationsPageComponent');
	});

	it('adds the Settings entry once the API answered, hides it after, and shows it again', () => {
		const available = new BehaviorSubject<boolean | null>(null);
		const { injector, nav } = injectorWith(available);
		registerTaskAutomationsEntryPoints(injector);
		available.next(false);
		expect(nav.addNavMenuItems).not.toHaveBeenCalled();

		available.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(1);
		const [[items, section]] = nav.addNavMenuItems.mock.calls;
		expect(section).toBe('settings');
		expect(items).toEqual([
			expect.objectContaining({
				id: TASK_AUTOMATIONS_NAV_ID,
				link: TASK_AUTOMATIONS_SETTINGS_LINK,
				data: expect.objectContaining({ permissionKeys: [PermissionsEnum.TASK_AUTOMATION_MANAGE] })
			})
		]);
		expect(items[0].data.hide()).toBe(false);

		available.next(true);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(1);

		// Signed out: the entry is added again (so the menu is rebuilt) and hidden.
		available.next(false);
		expect(nav.addNavMenuItems).toHaveBeenCalledTimes(2);
		expect(nav.addNavMenuItems.mock.calls[1][0][0].data.hide()).toBe(true);
	});
});
