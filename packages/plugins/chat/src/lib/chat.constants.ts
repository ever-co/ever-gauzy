/** The REST prefix of the plugin's routes (`/api/chat/...`). */
export const CHAT_ROUTE_PREFIX = 'chat';

/** The aggregate types the plugin stamps on its outbox rows. */
export const CHAT_AGGREGATES = {
	CONVERSATION: 'chat_conversation',
	MESSAGE: 'chat_message',
	MEMBER: 'chat_member',
	THREAD: 'chat_thread'
} as const;

/** Messages a page answers by default, and at most. */
export const CHAT_PAGE_SIZE = 50;
export const CHAT_MAX_PAGE_SIZE = 200;


/** How long a mark-all-read can be undone. */
export const CHAT_READ_RESTORE_TTL_MS = 60 * 1000;

/** The most conversations one caller's states answer carries (every membership, bounded). */
export const CHAT_MAX_STATES = 2000;

/** The most people `GET /chat/people` lists (an organization larger than this browses by search in a later slice). */
export const CHAT_PEOPLE_MAX = 2000;
