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
	const head = scanHead(html);
	const meta = new Map<string, string>();
	for (const tag of head.tags) {
		if (tag.name !== 'meta') continue;
		const key = (tag.attributes.get('property') ?? tag.attributes.get('name') ?? tag.attributes.get('itemprop') ?? '').trim().toLowerCase();
		const content = tag.attributes.get('content');
		// The first of each wins (a page lists its main image first).
		if (key && content !== undefined && !meta.has(key)) meta.set(key, content);
	}
	const first = (...keys: string[]) => keys.map((key) => meta.get(key)).find((value) => value !== undefined && value.trim() !== '');
	const titleTag = head.title;

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
	const icon = iconOf(head.tags, pageUrl);
	if (icon) data.icon = icon;
	if (!data.title && !data.description && !data.image) return null;
	return data;
}

/** One start tag of a page's head, its attributes read. */
interface IHeadTag {
	name: string;
	attributes: Map<string, string>;
}

/** What the head of a page holds, as far as it was read: its start tags, its title's text, and whether it ended. */
export interface IHeadScan {
	tags: IHeadTag[];
	title?: string;
	ended: boolean;
}

/** Elements whose content is not markup: what they hold is never read as a tag (the title is read, as its text). */
const RAW_TEXT = new Set(['script', 'style', 'template', 'noscript', 'textarea', 'xmp', 'title']);
/** The most tags of a head that are read (a real head has a few dozen). */
const MAX_HEAD_TAGS = 2000;

/**
 * Reads the head of a page in one pass, in document order, as a browser's tokenizer would for what a preview needs:
 * a comment, a raw-text element (script, style, ...) and a quoted attribute value are skipped whole, so a `</head>`,
 * a `<body>` or a tag written inside one of them is never read as one. The head ends at a real `</head>` or `<body>`.
 *
 * Linear in the length of the page: every character is looked at a bounded number of times, and a comment, element or
 * tag that is not closed yet (a page read only so far) ends the scan there, with nothing after it read. No regular
 * expression is run over the page itself, so no page can make the scan backtrack.
 */
export function scanHead(html: string): IHeadScan {
	const text = String(html ?? '');
	// ASCII letters only, so every offset found in `lower` is the same in `text` (a full lowercasing can change the
	// length: `İ` becomes two code units).
	const lower = asciiLower(text);
	const tags: IHeadTag[] = [];
	let title: string | undefined;
	let at = 0;
	while (at < text.length) {
		const open = text.indexOf('<', at);
		if (open < 0) break;
		if (lower.startsWith('<!--', open)) {
			const close = lower.indexOf('-->', open + 4);
			if (close < 0) break;
			at = close + 3;
			continue;
		}
		if (lower.startsWith('</', open)) {
			const name = tagNameAt(lower, open + 2);
			if (name === 'head') return { tags, title, ended: true };
			if (!name) {
				at = open + 1;
				continue;
			}
			const close = lower.indexOf('>', open + 2 + name.length);
			if (close < 0) break;
			at = close + 1;
			continue;
		}
		const name = tagNameAt(lower, open + 1);
		if (!name) {
			// A `<` that opens no tag is text.
			at = open + 1;
			continue;
		}
		if (name === 'body') return { tags, title, ended: true };
		const end = startTagEnd(text, open + 1 + name.length);
		if (end < 0) break;
		at = end + 1;
		if (RAW_TEXT.has(name)) {
			const close = closingTagAt(lower, name, at);
			if (close < 0) break;
			if (name === 'title' && title === undefined) title = text.slice(at, close);
			const after = lower.indexOf('>', close);
			if (after < 0) break;
			at = after + 1;
			continue;
		}
		if (tags.length < MAX_HEAD_TAGS) tags.push({ name, attributes: attributesOf(text.slice(open, end + 1)) });
	}
	return { tags, title, ended: false };
}

/**
 * Whether the start of a page read so far holds the end of its head: a real `</head>` or `<body>`, not one written
 * inside a script, a style, a comment, the title or a quoted attribute value. The fetch stops reading there.
 */
export function headEnded(html: string): boolean {
	return scanHead(html).ended;
}

/** The text with its ASCII capitals in lower case and nothing else changed: the same length, the same offsets. */
function asciiLower(text: string): string {
	return text.replace(/[A-Z]+/g, (capitals) => capitals.toLowerCase());
}

/**
 * Where the closing tag of a raw-text element starts (`</script` followed by a space, `/` or `>`), searching from
 * `from`, or -1 when it is not there (yet). A longer name (`</scripture`) is text inside the element, not its end.
 */
function closingTagAt(lower: string, name: string, from: number): number {
	const needle = `</${name}`;
	let at = lower.indexOf(needle, from);
	while (at >= 0) {
		const next = lower[at + needle.length];
		// Read only so far: whether this closes the element is not known yet.
		if (next === undefined) return -1;
		if (next === '>' || next === '/' || next.trim() === '') return at;
		at = lower.indexOf(needle, at + 1);
	}
	return -1;
}

/** The tag name (lower case) that starts at `at`, when a delimiter follows it (space, `/`, `>`, or the end); else null. */
function tagNameAt(lower: string, at: number): string | null {
	const first = lower.charCodeAt(at);
	if (!(first >= 97 && first <= 122)) return null;
	let end = at + 1;
	while (end < lower.length) {
		const code = lower.charCodeAt(end);
		const isNameChar = (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || code === 45 || code === 58;
		if (!isNameChar) break;
		end++;
	}
	if (end < lower.length) {
		const next = lower[end];
		if (next !== '>' && next !== '/' && next.trim() !== '') return null;
	}
	return lower.slice(at, end);
}

/** The index of the `>` that closes a start tag whose attributes begin at `from` (quoted values skipped), or -1. */
function startTagEnd(text: string, from: number): number {
	let quote: string | null = null;
	for (let index = from; index < text.length; index++) {
		const char = text[index];
		if (quote) {
			if (char === quote) quote = null;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === '>') {
			return index;
		}
	}
	return -1;
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
function iconOf(tags: IHeadTag[], pageUrl: string): string | undefined {
	let touch: string | undefined;
	for (const tag of tags) {
		if (tag.name !== 'link') continue;
		const attributes = tag.attributes;
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
	// Only as much of the value as can make up the limit (character references and markup included): the rest is never
	// read, so no value can make the cleaning below slow.
	let text = decodeEntities(String(value).slice(0, limit * 8));
	// Markup in a title or a description is text a page should not have put there: dropped, never kept as markup. A `<`
	// left over could open a tag where the text lands next to other markup, so it goes too; a lone `>` cannot, and stays.
	text = withoutMarkup(text);
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
	const text = decodeEntities(String(value).slice(0, CHAT_LINK_PREVIEW_LIMITS.url * 4)).replace(UNSAFE_CHARACTERS, '').trim();
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

/**
 * Text without anything tag-like: each `<` up to the next `>` becomes a space, and a `<` with no `>` after it is
 * dropped. One pass, linear in the length.
 */
function withoutMarkup(text: string): string {
	let out = '';
	let at = 0;
	while (at < text.length) {
		const open = text.indexOf('<', at);
		if (open < 0) return out + text.slice(at);
		out += text.slice(at, open);
		const close = text.indexOf('>', open + 1);
		if (close < 0) return out + text.slice(open + 1).split('<').join('');
		out += ' ';
		at = close + 1;
	}
	return out;
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
