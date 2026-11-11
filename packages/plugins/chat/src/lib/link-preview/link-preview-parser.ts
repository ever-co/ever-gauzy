// cspell:ignore itemprop precomposed ndash hellip lsquo rsquo sbquo ldquo rdquo bdquo laquo raquo middot
import { isIP } from 'node:net';
import { CHAT_LINK_PREVIEW_LIMITS } from './chat-link-preview.constants';
import { isPublicAddress, isRefusedHostname } from '../egress/egress-address';

/** What a page says about itself, as a preview keeps it: sanitized plain text and absolute `https:` URLs only. */
export interface ILinkPreviewData {
	title?: string;
	description?: string;
	siteName?: string;
	image?: string;
	imageAlt?: string;
	imageWidth?: number;
	imageHeight?: number;
	icon?: string;
}

/**
 * Reads a preview from the start of an HTML page: only its `<head>` (everything from the end of the head, or the start
 * of the body, on is ignored), and in it the Open Graph and Twitter card `<meta>` tags, the `<title>`, the description
 * and the icon `<link>`. Scripts, styles, templates and comments are dropped first, so text inside them never passes
 * for a tag.
 *
 * Every string is decoded (character references), stripped of markup, control and bidirectional-override characters,
 * whitespace-collapsed and cut to its limit; every URL is resolved against the page, kept only when it is `https:`
 * with no credentials, a public-looking host and a sane length. A page that yields none of title, description and
 * image yields nothing (`null`): it has no preview.
 *
 * @param html The decoded start of the page.
 * @param pageUrl The URL the page was read from (relative URLs resolve against it).
 */
export function parsePreviewHead(html: string, pageUrl: string): ILinkPreviewData | null {
	const head = headOf(html);
	const meta = new Map<string, string>();
	for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
		const attributes = attributesOf(tag);
		const key = (attributes.get('property') ?? attributes.get('name') ?? attributes.get('itemprop') ?? '').trim().toLowerCase();
		const content = attributes.get('content');
		// The first of each wins (a page lists its main image first).
		if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
	}
	const first = (...keys: string[]) => keys.map((key) => meta.get(key)).find((value) => value !== undefined && value.trim() !== '');
	const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1];

	const data: ILinkPreviewData = {};
	const title = cleanText(first('og:title', 'twitter:title') ?? titleTag, CHAT_LINK_PREVIEW_LIMITS.title);
	if (title) data.title = title;
	const description = cleanText(first('og:description', 'twitter:description', 'description'), CHAT_LINK_PREVIEW_LIMITS.description);
	if (description) data.description = description;
	const siteName = cleanText(first('og:site_name', 'application-name'), CHAT_LINK_PREVIEW_LIMITS.siteName);
	if (siteName) data.siteName = siteName;
	const image = cleanUrl(first('og:image:secure_url', 'og:image:url', 'og:image', 'twitter:image', 'twitter:image:src'), pageUrl);
	if (image) {
		data.image = image;
		const imageAlt = cleanText(first('og:image:alt', 'twitter:image:alt'), CHAT_LINK_PREVIEW_LIMITS.imageAlt);
		if (imageAlt) data.imageAlt = imageAlt;
		const width = dimension(first('og:image:width'));
		const height = dimension(first('og:image:height'));
		if (width && height) {
			data.imageWidth = width;
			data.imageHeight = height;
		}
	}
	const icon = iconOf(head, pageUrl);
	if (icon) data.icon = icon;
	if (!data.title && !data.description && !data.image) return null;
	return data;
}

/** The head of a page: up to the end of `<head>` or the start of `<body>`, without scripts, styles and comments. */
function headOf(html: string): string {
	let text = String(html ?? '');
	// Comments first: a commented-out `</head>` must not end the head.
	text = text.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ');
	text = text.replace(/<(script|style|template|noscript|textarea|xmp)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ');
	const end = text.search(/<\/head\s*>|<body[\s>/]/i);
	return end >= 0 ? text.slice(0, end) : text;
}

/** The attributes of one start tag, names lower-cased, values as written (decoded once, where they are used). */
function attributesOf(tag: string): Map<string, string> {
	const attributes = new Map<string, string>();
	const inner = tag.replace(/^<[a-z0-9]+/i, '').replace(/\/?>$/, '');
	const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(inner))) {
		const name = match[1].toLowerCase();
		if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
	}
	return attributes;
}

/** The page's icon: the first `<link rel="icon">` (or `shortcut icon`), else its touch icon. */
function iconOf(head: string, pageUrl: string): string | undefined {
	let touch: string | undefined;
	for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
		const attributes = attributesOf(tag);
		const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/);
		const href = attributes.get('href');
		if (!href) continue;
		if (rel.includes('icon')) {
			const icon = cleanUrl(href, pageUrl);
			if (icon) return icon;
		} else if (!touch && (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed'))) {
			touch = cleanUrl(href, pageUrl);
		}
	}
	return touch;
}

/** Characters a preview never keeps: controls (C0, C1, DEL), bidirectional overrides and isolates, the byte order mark. */
const UNSAFE_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Plain text: decoded, without markup or unsafe characters, whitespace collapsed, at most `limit` characters. */
export function cleanText(value: string | undefined, limit: number): string | undefined {
	if (value === undefined || value === null) return undefined;
	let text = decodeEntities(String(value));
	// Markup in a title or a description is text a page should not have put there: dropped, never kept as markup.
	text = text.replace(/<[^>]*>/g, ' ').replace(/[<>]/g, '');
	text = text.replace(UNSAFE_CHARACTERS, '').replace(/[\s\u2028\u2029\u00A0]+/g, ' ').trim();
	if (!text) return undefined;
	if (text.length <= limit) return text;
	// Cut on a code point boundary, with an ellipsis.
	const points = Array.from(text);
	return points.length <= limit ? text : `${points.slice(0, limit - 1).join('').trimEnd()}\u2026`;
}

/**
 * A URL a client may load (an image, an icon): resolved against the page, `https:` only (an `http:` image on an
 * `https:` page is mixed content, a `data:` or `javascript:` one is never an image to load), no credentials, a host
 * that is not internal by name nor a private address literal (a page must not point every viewer's browser at their
 * own network), at most the URL limit.
 */
export function cleanUrl(value: string | undefined, pageUrl: string): string | undefined {
	if (value === undefined || value === null) return undefined;
	const text = decodeEntities(String(value)).replace(UNSAFE_CHARACTERS, '').trim();
	if (!text) return undefined;
	let url: URL;
	try {
		url = new URL(text, pageUrl);
	} catch {
		return undefined;
	}
	if (url.protocol !== 'https:' || url.username || url.password) return undefined;
	const host = url.hostname.replace(/^\[|\]$/g, '');
	if (isIP(host) ? !isPublicAddress(host) : isRefusedHostname(host)) return undefined;
	const href = url.href;
	return href.length <= CHAT_LINK_PREVIEW_LIMITS.url ? href : undefined;
}

/** A positive pixel size no larger than the limit, or undefined. */
function dimension(value: string | undefined): number | undefined {
	const number = Number(String(value ?? '').trim());
	return Number.isInteger(number) && number > 0 && number <= CHAT_LINK_PREVIEW_LIMITS.dimension ? number : undefined;
}

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00A0',
	ndash: '\u2013',
	mdash: '\u2014',
	hellip: '\u2026',
	lsquo: '\u2018',
	rsquo: '\u2019',
	sbquo: '\u201A',
	ldquo: '\u201C',
	rdquo: '\u201D',
	bdquo: '\u201E',
	laquo: '\u00AB',
	raquo: '\u00BB',
	middot: '\u00B7',
	bull: '\u2022',
	copy: '\u00A9',
	reg: '\u00AE',
	trade: '\u2122',
	euro: '\u20AC',
	pound: '\u00A3',
	yen: '\u00A5',
	cent: '\u00A2',
	deg: '\u00B0',
	times: '\u00D7',
	divide: '\u00F7'
};

/** Decodes numeric character references and the common named ones; an invalid code point becomes U+FFFD. */
export function decodeEntities(text: string): string {
	return text.replace(/&(#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[a-zA-Z][a-zA-Z0-9]{1,31});?/g, (whole, body: string) => {
		if (body[0] === '#') {
			const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
			if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\uFFFD';
			return String.fromCodePoint(code);
		}
		return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, body) ? NAMED_ENTITIES[body] : whole;
	});
}

/**
 * The text of a page's start: in the charset its `Content-Type` named, else the one a `<meta charset>` (or
 * `http-equiv`) in its first bytes names, else UTF-8. An unknown charset is read as UTF-8.
 */
export function decodePage(body: Buffer, headerCharset: string | null): string {
	const sniffed = /<meta[^>]+charset\s*=\s*["']?\s*([a-zA-Z0-9_.:-]+)/i.exec(body.toString('latin1', 0, Math.min(body.length, 2048)))?.[1];
	for (const label of [headerCharset, sniffed, 'utf-8']) {
		if (!label) continue;
		try {
			return new TextDecoder(label.toLowerCase()).decode(body);
		} catch {
			// Not a charset this runtime knows: the next one.
		}
	}
	return body.toString('utf8');
}
