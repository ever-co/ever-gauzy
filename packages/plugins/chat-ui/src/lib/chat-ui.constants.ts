/** Path of the page, relative to `/pages` (`page-sections`). */
export const CHAT_PATH = 'chat';

/** Absolute link of the page. */
export const CHAT_LINK = `/pages/${CHAT_PATH}`;

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

/** The newest page a conversation opens with (the API's default is 50, its maximum 200). */
export const CHAT_PAGE_SIZE = 50;

/** Where a task card leads. */
export const CHAT_TASK_LINK = '/pages/tasks/view';

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
