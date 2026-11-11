import {
	CHAT_LINK_PREVIEW_MAX_BYTES,
	CHAT_LINK_PREVIEW_MAX_REDIRECTS,
	CHAT_LINK_PREVIEW_TIMEOUT_MS,
	CHAT_LINK_PREVIEW_USER_AGENT
} from './chat-link-preview.constants';
import {
	DEFAULT_EGRESS_POLICY,
	EgressBlockedError,
	EgressEncodingError,
	EgressResolver,
	guardedRequest,
	IEgressPolicy,
	readLimitedBody,
	firstHeaderValue,
	systemResolver
} from '../egress/egress-guard';

/**
 * The fetch of a page to preview, every hop through the chat plugin's egress guard (`egress/egress-guard.ts`: the URL
 * judged, every address its host resolves to judged, the connection pinned to those addresses).
 *
 * - **Redirects are followed by hand**, at most `maxRedirects`, each target a new `guardedRequest`, judged like the
 *   first: a redirect to a private address, an internal name or a name that resolves privately is refused before it
 *   is connected to.
 * - **Bounded**: one deadline for the whole fetch (every hop), and at most `maxBytes` of the page read (compressed and
 *   decompressed both counted). The read stops at the end of the `<head>`, which is all a preview needs, and only an
 *   HTML answer is read.
 *
 * Nothing about the person asking goes out: no cookie, no credential, no referrer; a generic user agent.
 */

/** Why a fetch gave no page. The caller stores all of them as "no preview" and tells the asker nothing more. */
export type LinkPreviewFetchFailure = 'blocked' | 'redirects' | 'timeout' | 'status' | 'type' | 'error';

export type LinkPreviewFetchOutcome =
	| {
			ok: true;
			/** The URL the page was read from (the last hop). */
			url: string;
			/** The answer's media type (lower case), when it named one. */
			contentType: string | null;
			/** The charset the answer's `Content-Type` named, when it named one. */
			charset: string | null;
			/** The start of the page, at most `maxBytes`, up to the end of its `<head>`. */
			body: Buffer;
	  }
	| { ok: false; reason: LinkPreviewFetchFailure };

/** Resolves a host name to its addresses. A seam: specs answer without a network. */
export type LinkPreviewResolver = EgressResolver;

export interface ILinkPreviewFetchOptions {
	timeoutMs: number;
	maxRedirects: number;
	maxBytes: number;
	userAgent: string;
	resolver: LinkPreviewResolver;
	/** What a hop may reach. The server always uses the default; specs narrow it to reach their own local server. */
	policy: IEgressPolicy;
}

export const DEFAULT_LINK_PREVIEW_FETCH_OPTIONS: ILinkPreviewFetchOptions = {
	timeoutMs: CHAT_LINK_PREVIEW_TIMEOUT_MS,
	maxRedirects: CHAT_LINK_PREVIEW_MAX_REDIRECTS,
	maxBytes: CHAT_LINK_PREVIEW_MAX_BYTES,
	userAgent: CHAT_LINK_PREVIEW_USER_AGENT,
	resolver: systemResolver,
	policy: DEFAULT_EGRESS_POLICY
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);
/** Where the `<head>` of a page has ended: its closing tag, or the start of the body. */
const HEAD_END = /<\/head\s*>|<body[\s>/]/i;

/**
 * Fetches the start of a page to preview, through the guard.
 *
 * @param link An absolute http(s) URL (the caller normalized it).
 * @param overrides Bounds and seams; the server passes none.
 * @returns The page's start, or why there is none. Never throws.
 */
export async function fetchPreviewPage(link: string | URL, overrides: Partial<ILinkPreviewFetchOptions> = {}): Promise<LinkPreviewFetchOutcome> {
	const options: ILinkPreviewFetchOptions = { ...DEFAULT_LINK_PREVIEW_FETCH_OPTIONS, ...overrides };
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs);
	timer.unref?.();
	try {
		let current = new URL(String(link));
		current.hash = '';
		for (let hop = 0; ; hop++) {
			const response = await guardedRequest(current, {
				headers: {
					'user-agent': options.userAgent,
					accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
					'accept-encoding': 'gzip, deflate, br'
				},
				signal: controller.signal,
				resolver: options.resolver,
				policy: options.policy
			});
			const status = response.statusCode ?? 0;
			if (REDIRECT_STATUSES.has(status)) {
				const location = firstHeaderValue(response.headers.location);
				response.destroy();
				if (!location) return { ok: false, reason: 'status' };
				if (hop >= options.maxRedirects) return { ok: false, reason: 'redirects' };
				const next = new URL(location, current);
				next.hash = '';
				current = next;
				continue;
			}
			if (status < 200 || status >= 300) {
				response.destroy();
				return { ok: false, reason: 'status' };
			}
			const contentType = firstHeaderValue(response.headers['content-type']);
			const mediaType = contentType ? contentType.split(';')[0].trim().toLowerCase() : null;
			if (mediaType && !HTML_TYPES.has(mediaType)) {
				response.destroy();
				return { ok: false, reason: 'type' };
			}
			const body = await readLimitedBody(response, {
				maxBytes: options.maxBytes,
				signal: controller.signal,
				stop: (window) => HEAD_END.test(window)
			});
			return { ok: true, url: current.href, contentType: mediaType, charset: charsetOf(contentType), body };
		}
	} catch (error) {
		if (controller.signal.aborted) return { ok: false, reason: 'timeout' };
		if (error instanceof EgressBlockedError) return { ok: false, reason: 'blocked' };
		if (error instanceof EgressEncodingError) return { ok: false, reason: 'type' };
		return { ok: false, reason: 'error' };
	} finally {
		clearTimeout(timer);
		// Tears down whatever is still open (nothing, on every path that returns normally).
		controller.abort();
	}
}

/** The charset a `Content-Type` names, or null. */
export function charsetOf(contentType: string | null | undefined): string | null {
	const match = /;\s*charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType ?? '');
	return match ? match[1].toLowerCase() : null;
}
