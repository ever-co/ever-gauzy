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
/** The read-only employee page (edit needs more than `ORG_EMPLOYEES_VIEW`). */
export const INBOX_EMPLOYEE_LINK = '/pages/employees/view';

/** Settings → Inbox → Providers, relative to `/pages/settings` (`settings-sections`, G-P4-2). */
export const INBOX_PROVIDERS_SETTINGS_PATH = 'inbox-providers';
export const INBOX_PROVIDERS_SETTINGS_LINK = `/pages/settings/${INBOX_PROVIDERS_SETTINGS_PATH}`;

/** Settings → Inbox → Mailboxes, relative to `/pages/settings` (`settings-sections`, G-P4-1). */
export const INBOX_MAILBOXES_SETTINGS_PATH = 'inbox-mailboxes';
export const INBOX_MAILBOXES_SETTINGS_LINK = `/pages/settings/${INBOX_MAILBOXES_SETTINGS_PATH}`;

/** "My mailbox", relative to the Inbox page (`/pages/inbox/mailbox`). */
export const INBOX_MY_MAILBOX_PATH = 'mailbox';
export const INBOX_MY_MAILBOX_LINK = `${INBOX_LINK}/${INBOX_MY_MAILBOX_PATH}`;

/** The core nav section the settings entries go under, and their ids. */
export const INBOX_SETTINGS_NAV_SECTION_ID = 'settings';
export const INBOX_PROVIDERS_NAV_ID = 'settings-inbox-providers';
export const INBOX_MAILBOXES_NAV_ID = 'settings-inbox-mailboxes';
