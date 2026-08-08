/**
 * The URL-scheme allowlist the read-only Documents surfaces hold every rendered `href`/`src` to.
 *
 * 🛑 Angular's own URL sanitizer is NOT this check. In v21 it is
 * `/^(?!javascript:)(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i` — a denylist of exactly ONE
 * scheme. Verified against the installed version (`markdown-render.util.spec.ts` pins it):
 * `javascript:` is rewritten to `unsafe:javascript:` in every spelling we could construct
 * (uppercase, entity-encoded, tab-split, leading whitespace), but
 *
 * - `data:text/html;base64,…` comes back **unchanged**,
 * - `vbscript:msgbox(1)` comes back **unchanged**,
 * - `data:image/svg+xml,…` comes back **unchanged** (SVG is scriptable outside `<img>`).
 *
 * Everything these surfaces render is attacker-controlled — an uploaded HTML/markdown file, a
 * page authored by another tenant user, or a legacy import — and the same Angular code also
 * ships inside the Electron desktop app, where the browser-level mitigations that make a
 * top-level `data:` navigation merely awkward are not something to rely on. So the app applies
 * its own **allowlist**, which is complete by construction: a scheme nobody enumerated is
 * rejected rather than passed. It mirrors `RICH_HTML_SANITIZE_OPTIONS` in
 * `@gauzy/core` (`core/html-sanitizer`), plus `blob:` for the object URLs the preview binds.
 */

/** Schemes a rendered `href`/`src` may carry. Everything else is dropped. */
const ALLOWED_URL_SCHEMES: ReadonlySet<string> = new Set(['http', 'https', 'mailto', 'tel', 'blob']);

/**
 * `data:` is permitted for raster images only — extraction inlines document images that way.
 * `image/svg+xml` is deliberately absent: an SVG document can carry script.
 */
const ALLOWED_DATA_URL = /^data:image\/(?:png|jpe?g|gif|webp|avif|bmp|x-icon)[;,]/;

/** A scheme, per RFC 3986: an ASCII letter followed by letters, digits, `+`, `-`, `.`. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/;

/**
 * Characters a URL parser removes before it reads the scheme: ASCII whitespace and C0/C1
 * controls (stripped from anywhere in the URL, not just the ends), the BOM, and the Unicode
 * line separators. Stripping them here is what closes `jav&#9;ascript:` and `\n javascript:`.
 */
const URL_IGNORED_CHARS = /[\u0000-\u0020\u007f-\u00a0\u2028\u2029\ufeff]/g;

/** The named entities that matter for smuggling a scheme past a byte comparison. */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
	amp: '&',
	colon: ':',
	tab: '\t',
	newline: '\n',
	sol: '/',
	quot: '"',
	apos: "'"
};

/** Numeric (`&#106;` / `&#x6a;`) and the named entities above. Linear — no nested quantifier. */
const ENTITY = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);?/gi;

/**
 * Decodes the entity forms a browser resolves before it looks at the scheme.
 *
 * Only ever used to DECIDE, never to produce the value that gets rendered, so over-decoding is
 * harmless: the worst it can do is reject a URL that was already safe.
 */
function decodeEntities(value: string): string {
	return value.replace(ENTITY, (match: string, body: string): string => {
		if (body.startsWith('#')) {
			const isHex = body[1] === 'x' || body[1] === 'X';
			const codePoint = Number.parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
			if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
				return match;
			}
			return String.fromCodePoint(codePoint);
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

/**
 * Reduces a URL to the form the browser will resolve, for scheme comparison only.
 */
function normalizeForSchemeCheck(value: string): string {
	return decodeEntities(value).replace(URL_IGNORED_CHARS, '').toLowerCase();
}

/**
 * Whether `value` may be rendered as a URL.
 *
 * Relative URLs, queries and fragments carry no scheme and are allowed. Anything with a scheme
 * must be on the allowlist above. Empty / absent values answer `false` — there is no URL to
 * render, so callers drop the attribute rather than emit `href=""`.
 *
 * @param value The raw attribute value (already entity-decoded if it came from a DOM read).
 * @returns Whether the value is safe to render.
 */
export function isAllowedUrl(value: string | null | undefined): boolean {
	if (value === null || value === undefined) {
		return false;
	}
	const normalized = normalizeForSchemeCheck(String(value));
	if (!normalized) {
		return false;
	}
	const scheme = SCHEME.exec(normalized)?.[1];
	if (!scheme) {
		// No scheme at all: a path, query or fragment, which resolves against the current origin.
		return true;
	}
	if (ALLOWED_URL_SCHEMES.has(scheme)) {
		return true;
	}
	return scheme === 'data' && ALLOWED_DATA_URL.test(normalized);
}

/**
 * Whether every candidate of a `srcset` is allowed. One bad candidate fails the whole
 * attribute — a partial `srcset` is worse than none.
 */
function isAllowedSrcset(value: string): boolean {
	return value
		.split(',')
		.map((candidate: string) => candidate.trim().split(/\s+/)[0])
		.filter((url: string) => url.length > 0)
		.every((url: string) => isAllowedUrl(url));
}

/** Attributes whose value a browser resolves as a URL. */
const URL_ATTRIBUTES: ReadonlySet<string> = new Set([
	'href',
	'src',
	'srcset',
	'xlink:href',
	'action',
	'formaction',
	'background',
	'cite',
	'longdesc',
	'poster',
	'ping',
	'profile',
	'usemap'
]);

/**
 * Drops every `href`/`src`/… whose scheme is not on the allowlist, from already-sanitized HTML.
 *
 * Parses rather than pattern-matches — a regex over markup cannot see what the browser will
 * see, and a `.replace()` that edits markup can splice a new construct together behind its own
 * cursor. `DOMParser` builds an INERT document, so nothing here loads a resource or runs.
 *
 * @param html HTML that has already been through Angular's sanitizer.
 * @returns The same HTML with unsafe URL attributes removed.
 */
export function stripUnsafeUrls(html: string): string {
	// Fail closed: without a parser the URLs cannot be checked, so nothing is rendered. This
	// package only ever runs in a browser/Electron renderer (and jsdom under test), where
	// `DOMParser` exists — Angular's own sanitizer needs a document too.
	if (typeof DOMParser === 'undefined') {
		return '';
	}
	const parsed = new DOMParser().parseFromString(html, 'text/html');
	for (const element of Array.from(parsed.body.querySelectorAll('*'))) {
		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name.toLowerCase();
			if (!URL_ATTRIBUTES.has(name)) {
				continue;
			}
			const allowed = name === 'srcset' ? isAllowedSrcset(attribute.value) : isAllowedUrl(attribute.value);
			if (!allowed) {
				element.removeAttribute(attribute.name);
			}
		}
	}
	return parsed.body.innerHTML;
}

/**
 * Guards a URL bound straight into `<img|video|audio [src]>`.
 *
 * The preview binds `URL.createObjectURL(blob)`, which is always `blob:<origin>/<uuid>` — this
 * is the check that keeps that true if the source of the URL ever changes to something
 * attacker-influenced, which is exactly the failure mode the removed `bypassSecurityTrustUrl`
 * would have hidden.
 *
 * @param url The URL to bind.
 * @returns The URL when its scheme is allowed, otherwise `null` (nothing is bound).
 */
export function sanitizeMediaUrl(url: string | null | undefined): string | null {
	return isAllowedUrl(url) ? (url as string) : null;
}
