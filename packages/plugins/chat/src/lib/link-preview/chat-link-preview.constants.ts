/** The queue the preview fetches travel on (where a queue root exists), and its one job. */
export const CHAT_LINK_PREVIEW_QUEUE = 'chat-link-preview';
export const CHAT_LINK_PREVIEW_FETCH_JOB = 'chat.link-preview.fetch';

/** How many previews one process fetches at once from the queue, and inline (without a queue root). */
export const CHAT_LINK_PREVIEW_WORKER_CONCURRENCY = 4;
export const CHAT_LINK_PREVIEW_INLINE_CONCURRENCY = 4;

/**
 * The refresh policy. A preview is served from the cache while it is fresh; a stale `ready` one is still served while
 * it is fetched again (its page rarely changes), an `unavailable` one is tried again once its shorter time is up, and
 * a `pending` one whose fetch never reported back (a process that stopped) is asked for again.
 */
export const CHAT_LINK_PREVIEW_READY_TTL_MS = 24 * 60 * 60 * 1000;
export const CHAT_LINK_PREVIEW_UNAVAILABLE_TTL_MS = 60 * 60 * 1000;
export const CHAT_LINK_PREVIEW_PENDING_TTL_MS = 2 * 60 * 1000;

/**
 * The fetches one person may start a minute (asks the cache cannot answer): beyond it the route answers 429. The
 * platform's rate limiter (`THROTTLE_ENABLED`, 120 asks a minute on this route) comes on top when it is on.
 */
export const CHAT_LINK_PREVIEW_FETCHES_PER_MINUTE = 60;

/** The bounds of one fetch: the whole of it (every hop), the redirects followed, and the bytes of the page read. */
export const CHAT_LINK_PREVIEW_TIMEOUT_MS = 5000;
export const CHAT_LINK_PREVIEW_MAX_REDIRECTS = 3;
export const CHAT_LINK_PREVIEW_MAX_BYTES = 512 * 1024;

/** The longest text of each field a preview keeps. */
export const CHAT_LINK_PREVIEW_LIMITS = {
	title: 300,
	description: 1000,
	siteName: 120,
	imageAlt: 300,
	url: 2048,
	dimension: 10000
} as const;

/** How the server introduces itself to the pages it previews. */
export const CHAT_LINK_PREVIEW_USER_AGENT = 'Mozilla/5.0 (compatible; GauzyLinkPreview/1.0)';

/**
 * Preview pictures (`GET /chat/link-preview/image?url=`): the types taken (by their bytes; never SVG), the largest
 * picture, and the per-process cache of the pictures served (by count and by bytes, a day each; a picture that could
 * not be fetched is not asked for again for ten minutes).
 */
export const CHAT_LINK_PREVIEW_IMAGE_TYPES: readonly string[] = ['image/avif', 'image/webp', 'image/png', 'image/jpeg', 'image/gif'];
export const CHAT_LINK_PREVIEW_IMAGE_MAX_BYTES = 1024 * 1024;
export const CHAT_LINK_PREVIEW_IMAGE_CACHE_ENTRIES = 256;
export const CHAT_LINK_PREVIEW_IMAGE_CACHE_BYTES = 32 * 1024 * 1024;
export const CHAT_LINK_PREVIEW_IMAGE_TTL_MS = 24 * 60 * 60 * 1000;
export const CHAT_LINK_PREVIEW_IMAGE_FAILURE_TTL_MS = 10 * 60 * 1000;
/** How many pictures one process fetches at once (beyond that the route answers 503 until one finished). */
export const CHAT_LINK_PREVIEW_IMAGE_CONCURRENCY = 4;
