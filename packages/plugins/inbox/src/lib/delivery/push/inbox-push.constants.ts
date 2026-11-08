/** A heartbeat of active input within this window is a focused session: no push to that person (FR-13). */
export const INBOX_PUSH_FOCUSED_WINDOW_MS = 90_000;
/** Consecutive failed pushes after which a device's subscription is removed. */
export const INBOX_PUSH_MAX_FAILURES = 5;
/** How long the push service keeps a push for a device that is offline. */
export const INBOX_PUSH_TTL_SECONDS = 24 * 60 * 60;
export const INBOX_PUSH_ENDPOINT_MAX = 2048;
export const INBOX_PUSH_KEY_MAX = 512;

/** Why a row was closed without a push. */
export const INBOX_PUSH_SKIPPED_FOCUSED = 'Not pushed: the person had an active, focused session.';
export const INBOX_PUSH_NO_SUBSCRIPTION = 'Not pushed: the person has no device subscribed.';

/** The VAPID identity the pushes are signed with. */
export interface IInboxWebPushConfig {
	publicKey: string;
	privateKey: string;
	/** The sender's `https:` URL or `mailto:` address, as the push services require. */
	subject: string;
}

/**
 * The VAPID key pair (`npx web-push generate-vapid-keys`) and the subject, from the environment; `null` without both
 * keys, when nothing is pushed. The subject is `GAUZY_INBOX_VAPID_SUBJECT`, else the client's `https:` address, else a
 * `mailto:` placeholder — a push service refuses a subject that is neither.
 */
export function readInboxWebPushConfig(env: Record<string, string | undefined> = process.env): IInboxWebPushConfig | null {
	const publicKey = (env['GAUZY_INBOX_VAPID_PUBLIC_KEY'] ?? '').trim();
	const privateKey = (env['GAUZY_INBOX_VAPID_PRIVATE_KEY'] ?? '').trim();
	if (!publicKey || !privateKey) return null;
	const stated = (env['GAUZY_INBOX_VAPID_SUBJECT'] ?? '').trim();
	const client = (env['CLIENT_BASE_URL'] ?? '').trim();
	const subject = stated || (client.startsWith('https://') ? withoutTrailingSlashes(client) : 'mailto:noreply@localhost');
	return { publicKey, privateKey, subject };
}

/** A URL without its trailing slashes, in one pass (`/\/+$/` is quadratic on a long run of slashes). */
function withoutTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charCodeAt(end - 1) === 47) end--;
	return value.slice(0, end);
}
