import { TASK_BULK_UPDATE_MAX } from '@gauzy/contracts';

/** Path of the page, relative to `/pages` (`page-sections`). */
export const TASK_VIEWS_PATH = 'task-views';

/** Absolute link of the page. */
export const TASK_VIEWS_LINK = `/pages/${TASK_VIEWS_PATH}`;

/** The segment of a built-in view (`/pages/task-views/built-in/mine`). */
export const TASK_VIEWS_BUILT_IN_SEGMENT = 'built-in';

/** The registry location of the plugin's own sections. */
export const TASK_VIEWS_SECTIONS_LOCATION = 'task-views-sections' as const;

/** The core nav section the Views entry goes into, and the entry's id. */
export const TASK_VIEWS_NAV_SECTION_ID = 'tasks';
export const TASK_VIEWS_NAV_ID = 'tasks-views';

/** Settings → Keyboard shortcuts (`settings-sections`). */
export const KEYBOARD_SETTINGS_PATH = 'keyboard-shortcuts';
export const KEYBOARD_SETTINGS_LINK = `/pages/settings/${KEYBOARD_SETTINGS_PATH}`;
export const KEYBOARD_SETTINGS_NAV_ID = 'settings-keyboard-shortcuts';
export const SETTINGS_NAV_SECTION_ID = 'settings';

/** Where a task opens: its own page. */
export const TASK_PAGE_LINK = '/pages/tasks/view';

/** The extension slot of a task's page the reference chip goes in (`PAGE_EXTENSION_SLOTS.TASK_VIEW_ACTIONS`). */
export const TASK_VIEW_ACTIONS_SLOT = 'task-view-actions';
export const TASK_REFERENCE_EXTENSION_ID = 'task-views-reference';

/** A page of a view's tasks (the API's default; its maximum is 200). */
export const TASK_VIEWS_PAGE_SIZE = 50;

/** A page of saved views, and the most the switcher lists. */
export const SAVED_VIEWS_PAGE_SIZE = 100;
export const SAVED_VIEWS_MAX = 500;

/** The most tasks one bulk action takes (the platform's limit), and so the most the selection holds. */
export const TASK_SELECTION_LIMIT = TASK_BULK_UPDATE_MAX;

/** How long the Undo of a bulk action is offered. */
export const BULK_UNDO_WINDOW_MS = 10_000;

/** How many deletes run at once when a selection is deleted. */
export const BULK_DELETE_CONCURRENCY = 4;

/** How long the registry waits for the next key of a sequence (`G` then `T`). */
export const SHORTCUT_SEQUENCE_TIMEOUT_MS = 1_200;

/** The relations a page of tasks carries (the platform's allowlist). */
export const TASK_VIEWS_RELATIONS = [
	'members',
	'members.user',
	'tags',
	'project',
	'teams',
	'organizationSprint',
	'taskStatus',
	'taskPriority',
	'taskSize'
];

/** The most manual-order entries a view keeps (the platform's limit). */
export const TASK_VIEW_ORDER_MAX = 5000;

/** The longest view name the dialogs take. */
export const TASK_VIEW_NAME_MAX = 80;
