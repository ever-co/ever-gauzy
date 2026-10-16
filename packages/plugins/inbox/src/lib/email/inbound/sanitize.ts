import * as sanitizeHtml from 'sanitize-html';

/** CSS values without `url(...)`, `expression(...)`, `@import` or escapes: colours, lengths, keywords. */
const SAFE_CSS_VALUE = [/^(?!.*(url|expression|import|\\|javascript))[#a-z0-9.,%()\s'"-]{1,200}$/i];

/**
 * The server-side policy for inbound email HTML (plan 04 §5.3, §5.4). The result is still shown only inside a
 * sandboxed `<iframe srcdoc>`, never through `bypassSecurityTrustHtml`.
 *
 * - Scripts, event handlers, forms and their widgets, `iframe` / `object` / `embed`, `svg` / `math`, `style` / `link`
 *   elements and `meta` refreshes are removed (anything not on the list is dropped).
 * - Links keep `http`, `https`, `mailto` and `tel`, and open in a new browsing context without a referrer.
 * - Remote images are blocked: their address moves to `data-remote-src` (a client may offer to load them through a
 *   proxy). `cid:` (inline parts) and `data:` images stay.
 * - Inline `style` keeps a short list of presentation properties with plain values (no `url()`, no `expression()`).
 */
export const EMAIL_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
	allowedTags: [
		'html',
		'body',
		'p',
		'div',
		'span',
		'center',
		'font',
		'h1',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'br',
		'hr',
		'strong',
		'b',
		'em',
		'i',
		'u',
		's',
		'strike',
		'small',
		'big',
		'sub',
		'sup',
		'code',
		'pre',
		'kbd',
		'samp',
		'tt',
		'mark',
		'abbr',
		'cite',
		'q',
		'blockquote',
		'address',
		'ul',
		'ol',
		'li',
		'dl',
		'dt',
		'dd',
		'a',
		'img',
		'figure',
		'figcaption',
		'table',
		'caption',
		'colgroup',
		'col',
		'thead',
		'tbody',
		'tfoot',
		'tr',
		'th',
		'td'
	],
	allowedAttributes: {
		'*': ['dir', 'lang', 'title', 'align', 'style'],
		a: ['href', 'name', 'target', 'rel'],
		img: ['src', 'alt', 'width', 'height', 'data-remote-src'],
		font: ['color', 'face', 'size'],
		table: ['width', 'height', 'border', 'cellpadding', 'cellspacing', 'bgcolor'],
		td: ['width', 'height', 'colspan', 'rowspan', 'valign', 'bgcolor', 'nowrap'],
		th: ['width', 'height', 'colspan', 'rowspan', 'valign', 'bgcolor', 'nowrap', 'scope'],
		tr: ['valign', 'bgcolor'],
		col: ['span', 'width'],
		colgroup: ['span', 'width'],
		ol: ['start', 'type'],
		li: ['value']
	},
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowedSchemesByTag: { img: ['cid', 'data'] },
	allowedSchemesAppliedToAttributes: ['href', 'src'],
	allowProtocolRelative: false,
	allowedStyles: {
		'*': {
			color: SAFE_CSS_VALUE,
			'background-color': SAFE_CSS_VALUE,
			'text-align': SAFE_CSS_VALUE,
			'vertical-align': SAFE_CSS_VALUE,
			'font-family': SAFE_CSS_VALUE,
			'font-size': SAFE_CSS_VALUE,
			'font-weight': SAFE_CSS_VALUE,
			'font-style': SAFE_CSS_VALUE,
			'line-height': SAFE_CSS_VALUE,
			'text-decoration': SAFE_CSS_VALUE,
			'white-space': SAFE_CSS_VALUE,
			width: SAFE_CSS_VALUE,
			'max-width': SAFE_CSS_VALUE,
			height: SAFE_CSS_VALUE,
			padding: SAFE_CSS_VALUE,
			'padding-top': SAFE_CSS_VALUE,
			'padding-bottom': SAFE_CSS_VALUE,
			'padding-left': SAFE_CSS_VALUE,
			'padding-right': SAFE_CSS_VALUE,
			margin: SAFE_CSS_VALUE,
			'margin-top': SAFE_CSS_VALUE,
			'margin-bottom': SAFE_CSS_VALUE,
			'margin-left': SAFE_CSS_VALUE,
			'margin-right': SAFE_CSS_VALUE,
			border: SAFE_CSS_VALUE,
			'border-collapse': SAFE_CSS_VALUE,
			'border-radius': SAFE_CSS_VALUE
		}
	},
	transformTags: {
		a: (tagName, attribs) => ({
			tagName,
			attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' }
		}),
		img: (tagName, attribs) => {
			const src = (attribs['src'] ?? '').trim();
			if (/^(https?:)?\/\//i.test(src)) {
				const { src: _remote, ...rest } = attribs;
				return { tagName, attribs: { ...rest, 'data-remote-src': src.slice(0, 2048) } };
			}
			return { tagName, attribs };
		}
	},
	// A message's head (title, style sheets) is not content.
	nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'title', 'head'],
	disallowedTagsMode: 'discard'
};

/** The longest inbound HTML part kept (a larger one is cut before sanitizing, then sanitized). */
export const MAX_HTML_LENGTH = 2 * 1024 * 1024;

/** Inbound email HTML, sanitized for storage and display. */
export function sanitizeEmailHtml(html: string): string {
	return sanitizeHtml(html.length > MAX_HTML_LENGTH ? html.slice(0, MAX_HTML_LENGTH) : html, EMAIL_HTML_SANITIZE_OPTIONS);
}

/** A numeric character reference's character (a space for an invalid one). */
const codePoint = (value: number) => (value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : ' ');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** The text of an HTML part, for a message that has no text part (line breaks kept, tags dropped). */
export function textFromHtml(html: string): string {
	const marked = (html.length > MAX_HTML_LENGTH ? html.slice(0, MAX_HTML_LENGTH) : html)
		.replace(/<\s*br\s*\/?>/gi, '\n')
		.replace(/<\/\s*(p|div|tr|li|h[1-6]|blockquote|table)\s*>/gi, '\n');
	const stripped = sanitizeHtml(marked, { allowedTags: [], allowedAttributes: {}, nonTextTags: ['style', 'script', 'title', 'head'] });
	return stripped
		.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (match, name: string) => {
			const key = name.toLowerCase();
			if (key in ENTITIES) return ENTITIES[key] as string;
			if (key.startsWith('#x')) return codePoint(Number.parseInt(key.slice(2), 16));
			if (key.startsWith('#')) return codePoint(Number.parseInt(key.slice(1), 10));
			return match;
		})
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** The first ~200 characters of a message's text, on one line (the list's preview). */
export function snippetOf(text: string | undefined | null): string {
	return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
}
