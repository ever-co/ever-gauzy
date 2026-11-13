// cspell:ignore ftypavif ftypavis WEBPVP
import {
	CHAT_LINK_PREVIEW_IMAGE_MAX_BYTES,
	CHAT_LINK_PREVIEW_IMAGE_TYPES
} from './chat-link-preview.constants';
import {
	DEFAULT_LINK_PREVIEW_FETCH_OPTIONS,
	fetchGuardedBody,
	ILinkPreviewFetchOptions,
	LinkPreviewFetchFailed,
	LinkPreviewFetchFailure
} from './link-preview-fetcher';

/** A preview's picture as the platform serves it: its bytes and the type they really are. */
export type LinkPreviewImageOutcome =
	| { ok: true; type: string; body: Buffer }
	| { ok: false; reason: LinkPreviewFetchFailure; status?: number };

/**
 * Fetches the picture a preview names, through the same egress guard as the page (every hop judged, the connection
 * pinned, one deadline), so a client can show it without the reader's browser loading it from the linked site.
 *
 * Only a raster picture is taken, and only by what its bytes are: PNG, JPEG, GIF, WebP or AVIF, at most
 * `CHAT_LINK_PREVIEW_IMAGE_MAX_BYTES`. An answer that says it is something else (SVG, which can carry script, among
 * them), is larger, or whose bytes are not one of those types, gives no picture.
 *
 * @returns The picture, or why there is none. Never throws.
 */
export async function fetchPreviewImage(link: string | URL, overrides: Partial<ILinkPreviewFetchOptions> = {}): Promise<LinkPreviewImageOutcome> {
	const options: ILinkPreviewFetchOptions = { ...DEFAULT_LINK_PREVIEW_FETCH_OPTIONS, maxBytes: CHAT_LINK_PREVIEW_IMAGE_MAX_BYTES, ...overrides };
	// One byte more than the limit may be read, so a picture of exactly the limit reads to its end and a larger one is
	// cut (refused as `size`). Only a picture read to its end is taken: a cut or broken one is never served.
	const outcome = await fetchGuardedBody(link, { ...options, maxBytes: options.maxBytes + 1 }, {
		accept: `${CHAT_LINK_PREVIEW_IMAGE_TYPES.join(',')};q=0.9`,
		allows: (mediaType) => !mediaType || CHAT_LINK_PREVIEW_IMAGE_TYPES.includes(mediaType) || mediaType === 'application/octet-stream',
		whole: true
	});
	if (!outcome.ok) return outcome as LinkPreviewFetchFailed;
	if (outcome.body.length > options.maxBytes) return { ok: false, reason: 'size' };
	const type = sniffImageType(outcome.body);
	if (!type) return { ok: false, reason: 'type' };
	return { ok: true, type, body: outcome.body };
}

/** What a picture's first bytes say it is (PNG, JPEG, GIF, WebP, AVIF), or null for anything else. */
export function sniffImageType(body: Buffer): string | null {
	if (!body || body.length < 12) return null;
	const starts = (bytes: number[], at = 0) => bytes.every((byte, index) => body[at + index] === byte);
	if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
	if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
	if (body.toString('latin1', 0, 6) === 'GIF87a' || body.toString('latin1', 0, 6) === 'GIF89a') return 'image/gif';
	if (body.toString('latin1', 0, 4) === 'RIFF' && body.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
	if (isAvif(body)) return 'image/avif';
	return null;
}

/**
 * Whether the bytes start with an ISO file-type box (`ftyp`) that names AVIF (`avif` or `avis`) as its major brand or
 * one of its compatible brands (an AVIF file may say `mif1` first). Only the box itself is read, within the bytes.
 */
function isAvif(body: Buffer): boolean {
	if (body.length < 16 || body.toString('latin1', 4, 8) !== 'ftyp') return false;
	const size = body.readUInt32BE(0);
	// The box ends where it says, never past the bytes read, nor past a sane length for a list of brands.
	const end = Math.min(size >= 16 ? size : 16, body.length, 256);
	const brands = [body.toString('latin1', 8, 12)];
	for (let at = 16; at + 4 <= end; at += 4) brands.push(body.toString('latin1', at, at + 4));
	return brands.includes('avif') || brands.includes('avis');
}
