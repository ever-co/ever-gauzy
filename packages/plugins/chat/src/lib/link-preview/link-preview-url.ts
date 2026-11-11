import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { CHAT_LINK_PREVIEW_URL_MAX_LENGTH } from '@gauzy/contracts';
import { isPublicAddress, isRefusedHostname } from './link-preview-address';

/** Why a link cannot be previewed at all: the route answers 400 for these. */
export class LinkPreviewUrlError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'LinkPreviewUrlError';
	}
}

/** The ports a preview connects to: the web's own (a link to anything else is not a web page to preview). */
export const LINK_PREVIEW_PORTS: readonly number[] = [80, 443, 8080, 8443];

/** What a hop of a preview fetch may reach; the defaults are the only ones the server uses (tests narrow them). */
export interface ILinkPreviewTargetPolicy {
	/** Whether an address the host is (or resolves to) may be connected to. */
	isAllowedAddress: (address: string) => boolean;
	/** The ports that may be connected to. */
	allowedPorts: readonly number[];
}

export const DEFAULT_LINK_PREVIEW_POLICY: ILinkPreviewTargetPolicy = {
	isAllowedAddress: isPublicAddress,
	allowedPorts: LINK_PREVIEW_PORTS
};

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

/** A URL's host as a connection names it: an IPv6 literal without its brackets. */
export function bareHostname(url: URL): string {
	return url.hostname.replace(/^\[|\]$/g, '');
}

/** The port a URL connects to (its scheme's default when it names none). */
export function portOf(url: URL): number {
	if (url.port) return Number(url.port);
	return url.protocol === 'https:' ? 443 : 80;
}

/**
 * Why one hop of a preview fetch may not go to this URL, judged on the URL alone (before any lookup), or null: not
 * http(s), credentials, a port other than the web's, a host name that never names a public site, or an address literal
 * that is not public. The host name of a URL that passes is still resolved and every address it resolves to judged.
 */
export function previewTargetRefusal(url: URL, policy: ILinkPreviewTargetPolicy = DEFAULT_LINK_PREVIEW_POLICY): string | null {
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'scheme';
	if (url.username || url.password) return 'credentials';
	if (!policy.allowedPorts.includes(portOf(url))) return 'port';
	const host = bareHostname(url);
	if (isIP(host)) return policy.isAllowedAddress(host) ? null : 'address';
	return isRefusedHostname(host) ? 'hostname' : null;
}
