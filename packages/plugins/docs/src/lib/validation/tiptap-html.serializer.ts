import { DOCS_SCHEMA_MARKS, DOCS_SCHEMA_NODES } from './tiptap-schema.validator';

/**
 * Derives the `contentHtml` render cache from a **schema-valid** `contentJson`
 * (`08-permissions-security.md` §6.1 step 2, "when the client omits it, the server derives it
 * from the validated JSON").
 *
 * Why this is a small hand-written serializer instead of `@tiptap/html`'s `generateHTML()`:
 * `generateHTML()` needs the *extension objects*, and three of this schema's node types
 * (`callout`, `fileAttachment`, `embedCard`) plus both mention registrations are defined inside
 * the Angular editor package. A backend package can never import them, so `generateHTML()` would
 * throw on exactly the nodes the platform authored itself. `05-editor-spec.md` §15 Q1 records the
 * same trade-off and defers cross-package schema sharing; until then the derived cache is produced
 * here, from the very inventory the validator already enforces.
 *
 * What the output is used for bounds how faithful it must be: `contentHtml` is a *derived* cache
 * for read-only surfaces, lexical content search and export (`05` §9.1) — `contentJson` stays
 * canonical and is the only thing ever loaded into an editor. So nodes with no counterpart in the
 * shared sanitizer allowlist (`callout`, `details`, `emoji`, math, embeds) degrade to the nearest
 * allowlisted element with their text intact, rather than being dropped.
 *
 * 🛑 The caller still runs the result through `sanitizeRichHtml`. Everything here is escaped at the
 * source, so that pass is defense in depth, not the primary control.
 */

/** Block/leaf node → the HTML element it renders as. */
const NODE_TAGS: Readonly<Record<string, string>> = {
	paragraph: 'p',
	blockquote: 'blockquote',
	bulletList: 'ul',
	orderedList: 'ol',
	listItem: 'li',
	taskList: 'ul',
	taskItem: 'li',
	table: 'table',
	tableRow: 'tr',
	tableHeader: 'th',
	tableCell: 'td',
	// No allowlisted equivalent — the nearest container that preserves the text (see the header).
	callout: 'blockquote',
	details: 'blockquote',
	detailsSummary: 'p',
	detailsContent: 'div'
};

/** Mark type → the HTML element it wraps text in. */
const MARK_TAGS: Readonly<Record<string, string>> = {
	bold: 'strong',
	italic: 'em',
	strike: 's',
	underline: 'u',
	code: 'code',
	subscript: 'sub',
	superscript: 'sup',
	highlight: 'mark',
	link: 'a',
	textStyle: 'span'
};

/** The inline CSS properties `textStyle` may carry, and the CSS property each maps to. */
const TEXT_STYLE_PROPERTIES: Readonly<Record<string, string>> = {
	color: 'color',
	backgroundColor: 'background-color',
	fontFamily: 'font-family',
	fontSize: 'font-size',
	lineHeight: 'line-height'
};

/**
 * Escapes a string for use in HTML text content or in a double-quoted attribute value.
 *
 * @param value The raw value.
 * @returns The escaped value.
 */
function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Renders an attribute map into a leading-space-prefixed attribute string, skipping empties.
 *
 * @param attributes The attribute name → value map.
 * @returns The serialized attributes (empty string when nothing survives).
 */
function renderAttributes(attributes: Record<string, unknown>): string {
	const parts = Object.entries(attributes)
		.filter(([, value]) => value !== undefined && value !== null && value !== '')
		.map(([name, value]) => `${name}="${escapeHtml(value)}"`);
	return parts.length ? ` ${parts.join(' ')}` : '';
}

/** Reads the `attrs` bag of a node/mark as a plain object. */
function attrsOf(node: Record<string, unknown>): Record<string, unknown> {
	const attrs = node['attrs'];
	return attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? (attrs as Record<string, unknown>) : {};
}

/**
 * Wraps rendered text in its marks, innermost mark first (the order TipTap stores them in).
 *
 * @param text The already-escaped text.
 * @param marks The node's marks.
 * @returns The wrapped HTML.
 */
function applyMarks(text: string, marks: unknown): string {
	if (!Array.isArray(marks)) {
		return text;
	}
	return marks.reduce((inner: string, mark: unknown) => {
		if (!mark || typeof mark !== 'object') {
			return inner;
		}
		const type = (mark as Record<string, unknown>)['type'];
		if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(DOCS_SCHEMA_MARKS, type)) {
			return inner;
		}
		const tag = MARK_TAGS[type];
		if (!tag) {
			return inner;
		}
		const attrs = attrsOf(mark as Record<string, unknown>);

		if (type === 'link') {
			return `<a${renderAttributes({
				href: attrs['href'],
				title: attrs['title'],
				target: attrs['target'] ?? '_blank',
				rel: 'noopener noreferrer nofollow'
			})}>${inner}</a>`;
		}
		if (type === 'highlight') {
			const color = attrs['color'];
			return `<mark${color ? renderAttributes({ style: `background-color: ${color}` }) : ''}>${inner}</mark>`;
		}
		if (type === 'textStyle') {
			const style = Object.entries(TEXT_STYLE_PROPERTIES)
				.filter(([key]) => attrs[key])
				.map(([key, property]) => `${property}: ${attrs[key]}`)
				.join('; ');
			return style ? `<span${renderAttributes({ style })}>${inner}</span>` : inner;
		}
		return `<${tag}>${inner}</${tag}>`;
	}, text);
}

/**
 * Renders the children of a node.
 *
 * @param node The parent node.
 * @returns The concatenated child HTML.
 */
function renderChildren(node: Record<string, unknown>): string {
	const content = node['content'];
	if (!Array.isArray(content)) {
		return '';
	}
	return content.map((child: unknown) => renderNode(child)).join('');
}

/**
 * Renders one node of a validated document.
 *
 * @param value The node.
 * @returns The node's HTML.
 */
function renderNode(value: unknown): string {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return '';
	}
	const node = value as Record<string, unknown>;
	const type = node['type'];
	if (typeof type !== 'string' || !Object.prototype.hasOwnProperty.call(DOCS_SCHEMA_NODES, type)) {
		return ''; // unreachable for validated input — the validator already 400s on unknown types
	}
	const attrs = attrsOf(node);

	switch (type) {
		case 'doc':
			return renderChildren(node);
		case 'text':
			return applyMarks(escapeHtml(node['text']), node['marks']);
		case 'hardBreak':
			return '<br />';
		case 'horizontalRule':
			return '<hr />';
		case 'heading': {
			const level = Math.min(Math.max(Number(attrs['level']) || 1, 1), 6);
			return `<h${level}${styleForAlign(attrs)}>${renderChildren(node)}</h${level}>`;
		}
		case 'paragraph':
			return `<p${styleForAlign(attrs)}>${renderChildren(node)}</p>`;
		case 'codeBlock': {
			const language = attrs['language'];
			const classAttribute = language ? renderAttributes({ class: `language-${language}` }) : '';
			return `<pre><code${classAttribute}>${renderChildren(node)}</code></pre>`;
		}
		case 'taskItem': {
			// The sanitizer allowlist has no `input`, so the state renders as a text glyph.
			const marker = attrs['checked'] === true ? '☑ ' : '☐ ';
			return `<li>${marker}${renderChildren(node)}</li>`;
		}
		case 'image':
			return `<img${renderAttributes({
				src: attrs['src'],
				alt: attrs['alt'],
				title: attrs['title'],
				width: attrs['width'],
				height: attrs['height']
			})} />`;
		case 'youtube':
			return `<p><a${renderAttributes({
				href: attrs['src'],
				rel: 'noopener noreferrer nofollow'
			})}>${escapeHtml(attrs['src'])}</a></p>`;
		case 'embedCard':
			return `<p><a${renderAttributes({
				href: attrs['url'],
				rel: 'noopener noreferrer nofollow'
			})}>${escapeHtml(attrs['title'] || attrs['url'])}</a></p>`;
		case 'fileAttachment':
			// The same URL shape the markdown serializer uses (`05` §9.3).
			return `<p><a${renderAttributes({
				href: attrs['documentId'] ? `/api/plugins/docs/documents/${attrs['documentId']}/raw` : undefined
			})}>${escapeHtml(attrs['name'])}</a></p>`;
		case 'emoji':
			return `<span>:${escapeHtml(attrs['name'])}:</span>`;
		case 'inlineMath':
			return `<code>${escapeHtml(attrs['latex'])}</code>`;
		case 'blockMath':
			return `<pre><code>${escapeHtml(attrs['latex'])}</code></pre>`;
		case 'employeeMention':
			return `<span>@${escapeHtml(attrs['label'] ?? attrs['id'])}</span>`;
		case 'documentMention':
			return `<a${renderAttributes({ href: `/pages/documents?id=${attrs['id']}` })}>${escapeHtml(
				attrs['label'] ?? attrs['id']
			)}</a>`;
		case 'tableHeader':
		case 'tableCell':
			return `<${NODE_TAGS[type]}${renderAttributes({
				colspan: attrs['colspan'],
				rowspan: attrs['rowspan']
			})}>${renderChildren(node)}</${NODE_TAGS[type]}>`;
		default: {
			const tag = NODE_TAGS[type];
			return tag ? `<${tag}>${renderChildren(node)}</${tag}>` : renderChildren(node);
		}
	}
}

/**
 * The `text-align` inline style of a `TextAlign`-enabled node, or an empty string.
 *
 * @param attrs The node attributes.
 * @returns The rendered `style` attribute (with a leading space) or an empty string.
 */
function styleForAlign(attrs: Record<string, unknown>): string {
	const align = attrs['textAlign'];
	return align ? renderAttributes({ style: `text-align: ${align}` }) : '';
}

/**
 * Serializes a validated TipTap document into the derived `contentHtml` cache.
 *
 * @param contentJson A document already accepted by `validateTiptapDocument()`.
 * @returns The derived HTML (empty string for an empty document).
 */
export function generateDocumentHtml(contentJson: unknown): string {
	return renderNode(contentJson);
}
