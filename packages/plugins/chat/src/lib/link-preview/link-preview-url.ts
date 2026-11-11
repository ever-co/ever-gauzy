import { createHash } from 'node:crypto';
import { CHAT_LINK_PREVIEW_URL_MAX_LENGTH } from '@gauzy/contracts';
import { DEFAULT_EGRESS_POLICY, egressTargetRefusal, EgressRefusal, IEgressPolicy } from '../egress/egress-guard';

/** Why a link cannot be previewed at all: the route answers 400 for these. */
export class LinkPreviewUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LinkPreviewUrlError';
	}
}

/**
 * The link a preview is of, as the cache keys it: an absolute `http:` or `https:` URL with no credentials and no
 * fragment (never sent to the server), in the URL parser's normal form (lower-case host, punycode, the default port
 * left out, `0x7f.1` and `2130706433` written as `127.0.0.1`).
 *
 * @throws LinkPreviewUrlError when the value is not such a link.
 */
export function normalizePreviewUrl(raw: unknown): URL {
	const text = typeof raw === 'string' ? raw.trim() : '';
	if (!text) throw new LinkPreviewUrlError('A link preview needs a url.');
	if (text.length > CHAT_LINK_PREVIEW_URL_MAX_LENGTH) {
		throw new LinkPreviewUrlError(`A link preview url is at most ${CHAT_LINK_PREVIEW_URL_MAX_LENGTH} characters.`);
	}
	let url: URL;
	try {
		url = new URL(text);
	} catch {
		throw new LinkPreviewUrlError('A link preview needs an absolute url.');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new LinkPreviewUrlError('A link preview is of an http or https link only.');
	}
	if (url.username || url.password) {
		throw new LinkPreviewUrlError('A link preview url must not carry credentials.');
	}
	if (!url.hostname) throw new LinkPreviewUrlError('A link preview url needs a host.');
	url.hash = '';
	if (url.href.length > CHAT_LINK_PREVIEW_URL_MAX_LENGTH) {
		throw new LinkPreviewUrlError(`A link preview url is at most ${CHAT_LINK_PREVIEW_URL_MAX_LENGTH} characters.`);
	}
	return url;
}

/** The cache key of a normalized link: the SHA-256 of its text, in hex. */
export function previewUrlHash(url: URL | string): string {
	return createHash('sha256').update(typeof url === 'string' ? url : url.href).digest('hex');
}

/**
 * Why a preview may not be fetched from this URL, judged on the URL alone (the chat egress guard's
 * `egressTargetRefusal`), or null. A link refused here answers "unavailable" without a fetch or a row.
 */
export function previewTargetRefusal(url: URL, policy: IEgressPolicy = DEFAULT_EGRESS_POLICY): EgressRefusal | null {
	return egressTargetRefusal(url, policy);
}
