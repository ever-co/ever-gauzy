/** Path of the page, relative to `/pages` (`page-sections`). */
export const CHAT_PATH = 'chat';

/** Absolute link of the page. */
export const CHAT_LINK = `/pages/${CHAT_PATH}`;

/**
 * Query parameter of the page that opens my direct conversation with an employee (`/pages/chat?with=<employeeId>`),
 * found or created on arrival; other pages (the Teams dashboard's member card) link with it.
 */
export const CHAT_DIRECT_WITH_PARAM = 'with';

/** The registry location of the plugin's own sections. */
export const CHAT_SECTIONS_LOCATION = 'chat-sections' as const;

/** Id of the nav-menu section and of the header action. */
export const CHAT_NAV_ID = 'chat';
export const CHAT_HEADER_ACTION_ID = 'chat-badge';

/** The core nav section the chat entry goes before. */
export const CHAT_NAV_BEFORE = 'tasks';

/** The views of the page besides a conversation. */
export const CHAT_UNREADS_PATH = 'unreads';
export const CHAT_THREADS_PATH = 'threads';

/** The header badge reads my states this often. */
export const CHAT_BADGE_POLL_MS = 60_000;
/** The conversation list refreshes this often while the tab is visible. */
export const CHAT_LIST_POLL_MS = 30_000;
/** The open conversation asks for newer messages this often while the tab is visible. */
export const CHAT_MESSAGES_POLL_MS = 5_000;
/** The open thread asks for newer replies this often while the tab is visible. */
export const CHAT_THREAD_POLL_MS = 5_000;
/**
 * While the chat events arrive live, the polls above run this often instead: a safety net for an event lost on the
 * way (the realtime README asks a live client to catch up about once a minute).
 */
export const CHAT_LIVE_SAFETY_POLL_MS = 60_000;
/** Events that arrive close together are applied once, this long after the first. */
export const CHAT_LIVE_AUDIT_MS = 300;
/** The lists (conversations, states, threads) refetch at most this often for events. */
export const CHAT_LIVE_LIST_AUDIT_MS = 1_000;

/** The newest page a conversation opens with (the API's default is 50, its maximum 200). */
export const CHAT_PAGE_SIZE = 50;

/** Where a task card leads. */
export const CHAT_TASK_LINK = '/pages/tasks/view';

/** The extension slot of a task's page the "Send to chat" button goes in (`PAGE_EXTENSION_SLOTS.TASK_VIEW_ACTIONS`). */
export const CHAT_TASK_ACTIONS_SLOT = 'task-view-actions';
/** Id of that extension. */
export const CHAT_SEND_TASK_EXTENSION_ID = 'chat-send-task';

/** The extension slot of an employee's page the "Message" button goes in (`PAGE_EXTENSION_SLOTS.EMPLOYEE_VIEW_ACTIONS`). */
export const CHAT_EMPLOYEE_ACTIONS_SLOT = 'employee-view-actions';
/** Id of that extension. */
export const CHAT_MESSAGE_EMPLOYEE_EXTENSION_ID = 'chat-message-employee';

/** The most people the `@` suggestions show. */
export const CHAT_MENTION_SUGGESTIONS = 8;

/** The emoji the reaction picker offers. */
export const CHAT_QUICK_REACTIONS = ['👍', '✅', '👀', '❤️', '🎉', '😂'] as const;

/** How many of the quick reactions a message's hover toolbar shows as one-click buttons. */
export const CHAT_TOOLBAR_REACTIONS = 3;

/** The emoji the composer's emoji button offers for insertion at the caret. */
export const CHAT_COMPOSER_EMOJI = [
	'😀',
	'😄',
	'😂',
	'🙂',
	'😉',
	'😍',
	'🤔',
	'😅',
	'😎',
	'🙏',
	'👍',
	'👎',
	'👏',
	'🙌',
	'💪',
	'👀',
	'✅',
	'❌',
	'🎉',
	'🔥',
	'❤️',
	'🚀',
	'💯',
	'⭐'
] as const;

/** Where the sidebar remembers which of its sections are collapsed (per browser). */
export const CHAT_COLLAPSED_SECTIONS_KEY = 'gauzy.chat.collapsedSections';
