/** Path of the page, relative to `/pages` (`page-sections`). */
export const INBOX_PATH = 'inbox';

/** Absolute link of the page. */
export const INBOX_LINK = `/pages/${INBOX_PATH}`;

/** The registry location of the plugin's own sections. */
export const INBOX_SECTIONS_LOCATION = 'inbox-sections' as const;

/** Id of the nav-menu section and of the header action. */
export const INBOX_NAV_ID = 'inbox';
export const INBOX_HEADER_ACTION_ID = 'inbox-badge';

/** The header badge reads the counts this often (plan 04 §1, P3a: polled every 60 s). */
export const INBOX_BADGE_POLL_MS = 60_000;

/** Items and notifications per page. */
export const INBOX_UI_PAGE_SIZE = 20;

/** The app's pages an item links to. */
export const INBOX_TASK_LINK = '/pages/tasks/view';
export const INBOX_PROJECT_LINK = '/pages/organization/projects';
export const INBOX_EMPLOYEE_LINK = '/pages/employees/edit';
