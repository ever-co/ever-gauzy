import { Injector } from '@angular/core';
import { Routes } from '@angular/router';
import { Subscription } from 'rxjs';
import { PermissionsEnum } from '@gauzy/contracts';
import {
	defineDeclarativePlugin,
	PageExtensionDefinition,
	PluginRouteInput,
	PluginUiDefinition
} from '@gauzy/plugin-ui';
import { NavMenuBuilderService, PermissionsGuard } from '@gauzy/ui-core/core';
import {
	KEYBOARD_SETTINGS_LINK,
	KEYBOARD_SETTINGS_NAV_ID,
	KEYBOARD_SETTINGS_PATH,
	SETTINGS_NAV_SECTION_ID,
	TASK_REFERENCE_EXTENSION_ID,
	TASK_VIEW_ACTIONS_SLOT,
	TASK_VIEWS_BUILT_IN_SEGMENT,
	TASK_VIEWS_LINK,
	TASK_VIEWS_NAV_ID,
	TASK_VIEWS_NAV_SECTION_ID,
	TASK_VIEWS_PATH,
	TASK_VIEWS_SECTIONS_LOCATION
} from './task-views-ui.constants';
import { registerGlobalShortcuts } from './keyboard/global-shortcuts';
import { ShortcutRegistryService } from './keyboard/shortcut-registry.service';
import { TaskViewsAvailabilityService } from './services/task-views-availability.service';
import en from '../i18n/en.json';

const loadPage = () =>
	import('./components/task-views-page/task-views-page.component').then((m) => m.TaskViewsPageComponent);

/** The page (standalone, loaded on first visit): a built-in view by key, or a saved view by id. */
export const TASK_VIEWS_CHILD_ROUTES: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: `${TASK_VIEWS_BUILT_IN_SEGMENT}/mine` },
	{ path: `${TASK_VIEWS_BUILT_IN_SEGMENT}/:key`, loadComponent: loadPage },
	{ path: ':viewId', loadComponent: loadPage }
];

/** `/pages/task-views`, for users who may see tasks. */
export const TASK_VIEWS_PAGE_ROUTE: PluginRouteInput = {
	location: 'page-sections',
	path: TASK_VIEWS_PATH,
	loadChildren: () => Promise.resolve(TASK_VIEWS_CHILD_ROUTES),
	canActivate: [PermissionsGuard],
	data: {
		permissions: {
			only: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW],
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

/** Settings → Keyboard shortcuts (`/pages/settings/keyboard-shortcuts`), every signed-in user's own. */
export const KEYBOARD_SETTINGS_ROUTE: PluginRouteInput = {
	location: 'settings-sections',
	path: KEYBOARD_SETTINGS_PATH,
	loadComponent: () =>
		import('./keyboard/keyboard-settings-page.component').then((m) => m.KeyboardSettingsPageComponent),
	data: {
		selectors: {
			project: false,
			team: false,
			employee: false,
			date: false,
			organization: true
		}
	}
};

/** `KEY-123` with copy on a task's own page, beside Edit and Copy link. */
export const TASK_REFERENCE_EXTENSION: PageExtensionDefinition = {
	id: TASK_REFERENCE_EXTENSION_ID,
	slotId: TASK_VIEW_ACTIONS_SLOT,
	loadComponent: () =>
		import('./components/task-reference-chip/task-reference-chip.component').then(
			(m) => m.TaskReferenceChipComponent
		),
	permissions: [PermissionsEnum.ORG_TASK_VIEW],
	order: 10,
	metadata: { title: 'Task reference', icon: 'hash-outline' }
};

/** The Tasks → Views entry of the core Tasks nav section. */
export const TASK_VIEWS_NAV_ITEM = {
	id: TASK_VIEWS_NAV_ID,
	title: 'Views',
	icon: 'fas fa-layer-group',
	link: TASK_VIEWS_LINK,
	pathMatch: 'prefix' as const,
	data: {
		translationKey: 'TASK_VIEWS.MENU',
		permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW]
	}
};

/** The Settings → Keyboard shortcuts entry. */
export const KEYBOARD_SETTINGS_NAV_ITEM = {
	id: KEYBOARD_SETTINGS_NAV_ID,
	title: 'Keyboard shortcuts',
	icon: 'fas fa-keyboard',
	link: KEYBOARD_SETTINGS_LINK,
	data: {
		translationKey: 'TASK_VIEWS.SHORTCUTS.MENU'
	}
};

/**
 * Adds the nav entries and mounts the keyboard shortcuts once the API serves the task views to the signed-in user,
 * and takes them away again when that changes (signed out, another organization, the switch turned off). Where the
 * API answers 404 (`GAUZY_TASK_VIEWS_ENABLED` unset, the default) none of it appears: no entry, no key listener, no
 * reference chip; the routes exist and the pages say the views are off.
 *
 * The nav builder has no way to remove an item, so the entries are hidden (`data.hide`) while the views are not
 * available, and added again (replacing themselves) at each change, so the menu is built anew and reads `hide`.
 */
export function registerTaskViewsEntryPoints(injector: Injector): Subscription {
	const state = { available: false, navAdded: false, removeShortcuts: null as null | (() => void) };
	return injector.get(TaskViewsAvailabilityService).available$.subscribe((available) => {
		const changed = available !== state.available;
		state.available = available;
		if ((available && !state.navAdded) || (state.navAdded && changed)) {
			state.navAdded = true;
			const nav = injector.get(NavMenuBuilderService);
			const hide = () => !state.available;
			nav.addNavMenuItems(
				[{ ...TASK_VIEWS_NAV_ITEM, data: { ...TASK_VIEWS_NAV_ITEM.data, hide } }] as never,
				TASK_VIEWS_NAV_SECTION_ID
			);
			nav.addNavMenuItems(
				[{ ...KEYBOARD_SETTINGS_NAV_ITEM, data: { ...KEYBOARD_SETTINGS_NAV_ITEM.data, hide } }] as never,
				SETTINGS_NAV_SECTION_ID
			);
		}
		const registry = injector.get(ShortcutRegistryService);
		if (available && !state.removeShortcuts) {
			state.removeShortcuts = registerGlobalShortcuts(injector);
			registry.mount();
		} else if (!available && state.removeShortcuts) {
			state.removeShortcuts();
			state.removeShortcuts = null;
			registry.unmount();
		}
	});
}

const declarative = defineDeclarativePlugin('task-views', {
	version: '0.1.0',
	location: TASK_VIEWS_SECTIONS_LOCATION,
	routes: [TASK_VIEWS_PAGE_ROUTE, KEYBOARD_SETTINGS_ROUTE],
	extensions: [TASK_REFERENCE_EXTENSION],
	permissionKeys: [PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TASK_VIEW],
	translationNamespace: 'TASK_VIEWS',
	translations: { en }
});

/**
 * Task views UI plugin (`@gauzy/plugin-task-views-ui`): `/pages/task-views` (the built-in and saved views with the
 * filter tree, grouping with counts, cursor paging, manual order, conflicts on a stale save, the bulk toolbar with
 * undo), the keyboard shortcut registry with its `?` help and Settings → Keyboard shortcuts, and `KEY-123`
 * references (the rows, the task's page, the go-to box). Registered in `apps/gauzy/src/plugin-ui.config.ts`; shows
 * nothing but its routes unless the API serves the task views extensions.
 */
export const TaskViewsUiPlugin: PluginUiDefinition = {
	...declarative,
	bootstrap: (injector: Injector) => {
		declarative.bootstrap?.(injector);
		registerTaskViewsEntryPoints(injector);
	}
};
