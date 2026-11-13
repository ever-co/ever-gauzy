import { Injector } from '@angular/core';
import { Subscription } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import { defineDeclarativePlugin, PluginRouteInput, PluginUiDefinition } from '@gauzy/plugin-ui';
import { NavMenuBuilderService, PermissionsGuard } from '@gauzy/ui-core/core';
import {
	TASK_AUTOMATIONS_NAV_ID,
	TASK_AUTOMATIONS_SECTIONS_LOCATION,
	TASK_AUTOMATIONS_SETTINGS_LINK,
	TASK_AUTOMATIONS_SETTINGS_NAV_SECTION_ID,
	TASK_AUTOMATIONS_SETTINGS_PATH
} from './task-automations-ui.constants';
import { TaskAutomationsAvailabilityService } from './services/task-automations-availability.service';
import en from '../i18n/en.json';

/**
 * Settings → Automations (`/pages/settings/automations`), a child of the core settings shell (`settings-sections`),
 * standalone and loaded on first visit; `TASK_AUTOMATION_MANAGE`, as the API's routes.
 */
export const TASK_AUTOMATIONS_SETTINGS_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: TASK_AUTOMATIONS_SETTINGS_PATH,
	loadComponent: () => import('./components/automations-page.component').then((m) => m.TaskAutomationsPageComponent),
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.TASK_AUTOMATION_MANAGE],
			redirectTo: '/pages/settings'
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

/** The Settings → Automations entry of the core Settings nav section. */
export const TASK_AUTOMATIONS_NAV_ITEM = {
	id: TASK_AUTOMATIONS_NAV_ID,
	title: 'Automations',
	icon: 'fas fa-robot',
	link: TASK_AUTOMATIONS_SETTINGS_LINK,
	data: {
		translationKey: 'TASK_AUTOMATIONS.MENU',
		permissionKeys: [PermissionsEnum.TASK_AUTOMATION_MANAGE]
	}
};

/**
 * Adds the Settings → Automations entry once the API confirmed it serves task automations to the signed-in user
 * (`TaskAutomationsAvailabilityService`), and hides it again when that changes (signed out, another user). Where the
 * API does not load `@gauzy/plugin-task-automations` (`GAUZY_TASK_AUTOMATIONS_ENABLED` unset, the default) the
 * settings menu looks exactly as before; the route still exists and the page then says the feature is off.
 *
 * The nav builder has no way to remove an item, so the entry is hidden (`data.hide`) while the feature is not
 * available, and added again (the same id replaces itself) at each change, so the menu is built anew and reads `hide`.
 */
export function registerTaskAutomationsEntryPoints(injector: Injector): Subscription {
	const state = { available: false, added: false };
	return injector.get(TaskAutomationsAvailabilityService).available$.subscribe((available) => {
		const changed = available !== state.available;
		state.available = available;
		if ((available && !state.added) || (state.added && changed)) {
			state.added = true;
			injector.get(NavMenuBuilderService).addNavMenuItems(
				[{ ...TASK_AUTOMATIONS_NAV_ITEM, data: { ...TASK_AUTOMATIONS_NAV_ITEM.data, hide: () => !state.available } }] as never,
				TASK_AUTOMATIONS_SETTINGS_NAV_SECTION_ID
			);
		}
	});
}

const declarative = defineDeclarativePlugin('task-automations', {
	version: '0.1.0',
	location: TASK_AUTOMATIONS_SECTIONS_LOCATION,
	routes: [TASK_AUTOMATIONS_SETTINGS_ROUTE],
	permissionKeys: [PermissionsEnum.TASK_AUTOMATION_MANAGE],
	translationNamespace: 'TASK_AUTOMATIONS',
	translations: { en }
});

/**
 * Task automations UI plugin (`@gauzy/plugin-task-automations-ui`, spec `docs/specs/features/task-automations`):
 * Settings → Automations — the organization's rules in their order (switch, reorder), create from a template or blank,
 * edit the trigger, conditions and actions, try a rule on a task (dry run) and read its runs. Registered in
 * `apps/gauzy/src/plugin-ui.config.ts`; shows nothing but the route unless the API serves task automations.
 */
export const TaskAutomationsUiPlugin: PluginUiDefinition = {
	...declarative,
	bootstrap: (injector: Injector) => {
		declarative.bootstrap?.(injector);
		registerTaskAutomationsEntryPoints(injector);
	}
};
