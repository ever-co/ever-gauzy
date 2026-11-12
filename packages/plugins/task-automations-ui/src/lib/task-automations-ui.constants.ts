/** Settings → Automations, relative to `/pages/settings` (`settings-sections`). */
export const TASK_AUTOMATIONS_SETTINGS_PATH = 'automations';

/** Absolute link of the page. */
export const TASK_AUTOMATIONS_SETTINGS_LINK = `/pages/settings/${TASK_AUTOMATIONS_SETTINGS_PATH}`;

/** The registry location of the plugin's own sections. */
export const TASK_AUTOMATIONS_SECTIONS_LOCATION = 'task-automations-sections' as const;

/** The core nav section the entry goes under, and its id. */
export const TASK_AUTOMATIONS_SETTINGS_NAV_SECTION_ID = 'settings';
export const TASK_AUTOMATIONS_NAV_ID = 'settings-task-automations';

/** The runs the history shows (the API keeps the last 200, answers at most 50). */
export const TASK_AUTOMATIONS_RUNS_SHOWN = 20;

/** The tasks the dry-run picker lists (the newest first). */
export const TASK_AUTOMATIONS_TEST_TASKS = 50;
