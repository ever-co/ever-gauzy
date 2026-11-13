// cspell:ignore subsup
/**
 * Atlassian Document Format (ADF, the rich text of Jira Cloud's API v3) to and from the HTML the platform's task store
 * keeps (`Task.description`, the shared rich-text editor's subset of HTML).
 *
 * ADF → HTML builds the markup itself from the document's nodes: every text is escaped, only the tags of the task
 * store's allowlist are written, and a link keeps an `http(s)`, `mailto` or `tel` address only. Nothing of the
 * document reaches the HTML as markup, so a description cannot carry a script, a handler or a `javascript:` address
 * whatever Jira sends; the task store sanitizes what it is given on top (`sanitizeRichHtml`).
 *
 * HTML → ADF reads the editor's subset back (paragraphs, headings, lists, quotes, code, rules, tables, and the
 * strong, emphasis, underline, strike, code, sub/superscript and link marks); any other tag is dropped and its text
 * kept. The two are each other's inverse on what they produce: `adfToHtml(htmlToAdf(adfToHtml(doc)))` is
 * `adfToHtml(doc)`, so a description sent to Jira and read back compares equal to the task's own
 * ({@link canonicalHtml}), and a round trip is never taken for a change on both sides.
 */

export interface AdfMark {
	type: string;
	attrs?: Record<string, unknown>;
}

export interface AdfNode {
	type: string;
	text?: string;
	attrs?: Record<string, unknown>;
	marks?: AdfMark[];
	content?: AdfNode[];
}

export interface AdfDocument extends AdfNode {
	type: 'doc';
	version: 1;
	content: AdfNode[];
}

/** The marks, in the order they nest (outermost first) and are listed in a text node. */
const MARK_ORDER = ['link', 'strong', 'em', 'underline', 'strike', 'subsup', 'code'] as const;
type MarkType = (typeof MARK_ORDER)[number];

const MARK_TAGS: Record<Exclude<MarkType, 'link' | 'subsup'>, string> = {
	strong: 'strong',
	em: 'em',
	underline: 'u',
	strike: 's',
	code: 'code'
};

/** Escapes the characters that would read as markup. */
export function escapeHtml(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** An address a link may keep: `http(s)`, `mailto` or `tel`; null for anything else (a `javascript:` URL, a relative path). */
export function safeHref(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const href = value.trim();
	if (!href || href.length > 2048) return null;
	return /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : null;
}

// ---------------------------------------------------------------- ADF → HTML

/** The marks of a text node the HTML keeps, in nesting order (a code mark keeps only its link, as ADF requires). */
function marksOf(node: AdfNode): AdfMark[] {
	const kept = (node.marks ?? []).filter((mark) => (MARK_ORDER as readonly string[]).includes(mark?.type));
	const hasCode = kept.some((mark) => mark.type === 'code');
	return kept
		.filter((mark) => !hasCode || mark.type === 'code' || mark.type === 'link')
		.filter((mark) => mark.type !== 'link' || safeHref(mark.attrs?.['href']))
		.filter((mark) => mark.type !== 'subsup' || mark.attrs?.['type'] === 'sub' || mark.attrs?.['type'] === 'sup')
		.sort((a, b) => MARK_ORDER.indexOf(a.type as MarkType) - MARK_ORDER.indexOf(b.type as MarkType));
}

function openTag(mark: AdfMark): string {
	if (mark.type === 'link') return `<a href="${escapeHtml(safeHref(mark.attrs?.['href']) as string)}" rel="noopener noreferrer">`;
	if (mark.type === 'subsup') return `<${mark.attrs?.['type'] === 'sub' ? 'sub' : 'sup'}>`;
	return `<${MARK_TAGS[mark.type as keyof typeof MARK_TAGS]}>`;
}

function closeTag(mark: AdfMark): string {
	if (mark.type === 'link') return '</a>';
	if (mark.type === 'subsup') return `</${mark.attrs?.['type'] === 'sub' ? 'sub' : 'sup'}>`;
	return `</${MARK_TAGS[mark.type as keyof typeof MARK_TAGS]}>`;
}

function textOf(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/** A text with its marks; a plain text for the inline nodes that carry text of their own (a mention, an emoji, a date). */
function inlineHtml(node: AdfNode): string {
	switch (node.type) {
		case 'text': {
			const text = textOf(node.text);
			if (!text) return '';
			const marks = marksOf(node);
			return `${marks.map(openTag).join('')}${escapeHtml(text)}${[...marks].reverse().map(closeTag).join('')}`;
		}
		case 'hardBreak':
			return '<br>';
		case 'mention': {
			const name = textOf(node.attrs?.['text']).replace(/^@/, '') || 'someone';
			return escapeHtml(`@${name}`);
		}
		case 'emoji':
			return escapeHtml(textOf(node.attrs?.['text']) || textOf(node.attrs?.['shortName']));
		case 'status':
			return escapeHtml(textOf(node.attrs?.['text']));
		case 'date': {
			const timestamp = Number(node.attrs?.['timestamp']);
			return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : '';
		}
		case 'inlineCard': {
			const href = safeHref(node.attrs?.['url']);
			return href ? `<a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(href)}</a>` : '';
		}
		default:
			// An unknown inline node with inline content of its own: its text, nothing of its markup.
			return (node.content ?? []).map(inlineHtml).join('');
	}
}

function inlineContentHtml(nodes: AdfNode[] | undefined): string {
	return (nodes ?? []).map(inlineHtml).join('');
}

function cellHtml(node: AdfNode, tag: 'th' | 'td'): string {
	const colspan = Number(node.attrs?.['colspan']);
	const rowspan = Number(node.attrs?.['rowspan']);
	const attributes = `${Number.isInteger(colspan) && colspan > 1 ? ` colspan="${colspan}"` : ''}${Number.isInteger(rowspan) && rowspan > 1 ? ` rowspan="${rowspan}"` : ''}`;
	return `<${tag}${attributes}>${blocksHtml(node.content)}</${tag}>`;
}

function blockHtml(node: AdfNode): string {
	switch (node.type) {
		case 'paragraph':
			return `<p>${inlineContentHtml(node.content)}</p>`;
		case 'heading': {
			const level = Math.min(Math.max(Number(node.attrs?.['level']) || 1, 1), 6);
			return `<h${level}>${inlineContentHtml(node.content)}</h${level}>`;
		}
		case 'bulletList':
			return `<ul>${(node.content ?? []).map(blockHtml).join('')}</ul>`;
		case 'orderedList': {
			const order = Number(node.attrs?.['order']);
			return `<ol${Number.isInteger(order) && order > 1 ? ` start="${order}"` : ''}>${(node.content ?? []).map(blockHtml).join('')}</ol>`;
		}
		case 'listItem':
			return `<li>${blocksHtml(node.content)}</li>`;
		case 'taskList':
		case 'decisionList':
			return `<ul>${(node.content ?? []).map(blockHtml).join('')}</ul>`;
		case 'taskItem': {
			const done = node.attrs?.['state'] === 'DONE';
			return `<li><p>${done ? '[x]' : '[ ]'} ${inlineContentHtml(node.content)}</p></li>`;
		}
		case 'decisionItem':
			return `<li><p>${inlineContentHtml(node.content)}</p></li>`;
		case 'codeBlock':
			return `<pre><code>${escapeHtml((node.content ?? []).map((child) => textOf(child.text)).join(''))}</code></pre>`;
		case 'blockquote':
		case 'panel':
			return `<blockquote>${blocksHtml(node.content)}</blockquote>`;
		case 'rule':
			return '<hr>';
		case 'table':
			return `<table><tbody>${(node.content ?? []).map(blockHtml).join('')}</tbody></table>`;
		case 'tableRow':
			return `<tr>${(node.content ?? []).map((cell) => cellHtml(cell, cell.type === 'tableHeader' ? 'th' : 'td')).join('')}</tr>`;
		case 'expand':
		case 'nestedExpand': {
			const title = textOf(node.attrs?.['title']).trim();
			return `${title ? `<p><strong>${escapeHtml(title)}</strong></p>` : ''}${blocksHtml(node.content)}`;
		}
		case 'blockCard':
		case 'embedCard': {
			const href = safeHref(node.attrs?.['url']);
			return href ? `<p><a href="${escapeHtml(href)}" rel="noopener noreferrer">${escapeHtml(href)}</a></p>` : '';
		}
		case 'mediaSingle':
		case 'mediaGroup':
		case 'media':
			// The files are the issue's attachments: brought in as the task's links, not inlined in its description.
			return '';
		default:
			// An unknown block: its blocks when it has some, its text as a paragraph when it has only inline content.
			if (!node.content?.length) return '';
			return node.content.some((child) => isBlockType(child.type)) ? blocksHtml(node.content) : `<p>${inlineContentHtml(node.content)}</p>`;
	}
}

const BLOCK_TYPES = new Set([
	'paragraph',
	'heading',
	'bulletList',
	'orderedList',
	'listItem',
	'taskList',
	'taskItem',
	'decisionList',
	'decisionItem',
	'codeBlock',
	'blockquote',
	'panel',
	'rule',
	'table',
	'tableRow',
	'tableHeader',
	'tableCell',
	'expand',
	'nestedExpand',
	'blockCard',
	'embedCard',
	'mediaSingle',
	'mediaGroup',
	'media'
]);

function isBlockType(type: string): boolean {
	return BLOCK_TYPES.has(type);
}

function blocksHtml(nodes: AdfNode[] | undefined): string {
	return (nodes ?? []).map(blockHtml).join('');
}

/**
 * A document as the task store's HTML; null for no document, and for one with nothing to show (an empty description
 * clears the task's).
 */
export function adfToHtml(doc: AdfNode | null | undefined): string | null {
	if (!doc || typeof doc !== 'object') return null;
	const html = doc.type === 'doc' ? blocksHtml(doc.content) : blockHtml(doc);
	return htmlHasContent(html) ? html : null;
}

/** Whether HTML shows anything: some text, a rule or a table. */
function htmlHasContent(html: string): boolean {
	return /<(hr|table)\b/i.test(html) || decodeEntities(html.replace(/<[^>]*>/g, '')).trim().length > 0;
}

/** A document's text alone (a comment's preview, a title fallback). */
export function adfToText(doc: AdfNode | null | undefined): string {
	if (!doc) return '';
	const parts: string[] = [];
	const walk = (node: AdfNode) => {
		if (node.type === 'text') parts.push(textOf(node.text));
		else if (node.type === 'hardBreak') parts.push('\n');
		else if (node.type === 'mention') parts.push(`@${textOf(node.attrs?.['text']).replace(/^@/, '')}`);
		for (const child of node.content ?? []) walk(child);
		if (isBlockType(node.type) && node.type !== 'listItem') parts.push('\n');
	};
	walk(doc);
	return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

// ---------------------------------------------------------------- HTML → ADF

interface HtmlElement {
	tag: string;
	attrs: Record<string, string>;
	children: HtmlNode[];
}

type HtmlNode = HtmlElement | string;

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col', 'input', 'meta', 'link', 'wbr']);
/** Elements whose content is not text of the document. */
const SKIPPED_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'head', 'title', 'noscript']);

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Decodes the entities of HTML text (named, decimal and hexadecimal); an unknown one is left as it is. */
export function decodeEntities(value: string): string {
	return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, name: string) => {
		const lower = name.toLowerCase();
		if (lower.startsWith('#x')) {
			const code = parseInt(lower.slice(2), 16);
			return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
		}
		if (lower.startsWith('#')) {
			const code = parseInt(lower.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
		}
		return NAMED_ENTITIES[lower] ?? whole;
	});
}

function attributesOf(source: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	const pattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(source))) {
		attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
	}
	return attrs;
}

/** A forgiving parse of HTML into elements and texts: an unclosed element ends with its parent, a stray end tag is ignored. */
export function parseHtml(html: string): HtmlNode[] {
	const root: HtmlElement = { tag: '#root', attrs: {}, children: [] };
	const stack: HtmlElement[] = [root];
	const pattern = /<!--[\s\S]*?-->|<\/\s*([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|</g;
	let match: RegExpExecArray | null;
	let skipping: string | null = null;
	while ((match = pattern.exec(html))) {
		const [whole, closing, opening, attributes, text] = match;
		const top = stack[stack.length - 1];
		if (skipping) {
			if (closing && closing.toLowerCase() === skipping) skipping = null;
			continue;
		}
		if (whole.startsWith('<!--')) continue;
		if (text !== undefined || whole === '<') {
			// Adjacent texts are one text (a stray `<` is text too).
			const value = decodeEntities(text ?? '<');
			const last = top.children[top.children.length - 1];
			if (typeof last === 'string') top.children[top.children.length - 1] = last + value;
			else top.children.push(value);
			continue;
		}
		if (opening) {
			const tag = opening.toLowerCase();
			if (SKIPPED_TAGS.has(tag)) {
				if (!/\/\s*$/.test(attributes ?? '')) skipping = tag;
				continue;
			}
			const element: HtmlElement = { tag, attrs: attributesOf(attributes ?? ''), children: [] };
			top.children.push(element);
			if (!VOID_TAGS.has(tag) && !/\/\s*$/.test(attributes ?? '')) stack.push(element);
			continue;
		}
		if (closing) {
			const tag = closing.toLowerCase();
			const at = stack.map((element) => element.tag).lastIndexOf(tag);
			if (at > 0) stack.length = at;
		}
	}
	return root.children;
}

const HEADING_TAGS: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'section', 'article', 'header', 'footer', 'figure', 'colgroup']);

function isBlockElement(node: HtmlNode): node is HtmlElement {
	return typeof node !== 'string' && BLOCK_TAGS.has(node.tag);
}

function markOfElement(element: HtmlElement): AdfMark | null {
	switch (element.tag) {
		case 'strong':
		case 'b':
			return { type: 'strong' };
		case 'em':
		case 'i':
			return { type: 'em' };
		case 'u':
			return { type: 'underline' };
		case 's':
		case 'strike':
		case 'del':
			return { type: 'strike' };
		case 'code':
			return { type: 'code' };
		case 'sub':
			return { type: 'subsup', attrs: { type: 'sub' } };
		case 'sup':
			return { type: 'subsup', attrs: { type: 'sup' } };
		case 'a': {
			const href = safeHref(element.attrs['href']);
			return href ? { type: 'link', attrs: { href } } : null;
		}
		default:
			return null;
	}
}

/** The marks of a text, canonical: each type once, in {@link MARK_ORDER}, a code mark keeping only its link. */
function canonicalMarks(marks: AdfMark[]): AdfMark[] | undefined {
	const byType = new Map<string, AdfMark>();
	for (const mark of marks) if (!byType.has(mark.type)) byType.set(mark.type, mark);
	const hasCode = byType.has('code');
	const kept = MARK_ORDER.filter((type) => byType.has(type) && (!hasCode || type === 'code' || type === 'link')).map((type) => byType.get(type) as AdfMark);
	return kept.length ? kept : undefined;
}

/** Adds an inline node; a text next to one with the same marks is one text (the document is the same whatever the markup's splits). */
function pushInline(result: AdfNode[], node: AdfNode): void {
	const last = result[result.length - 1];
	if (node.type === 'text' && last?.type === 'text' && JSON.stringify(last.marks ?? null) === JSON.stringify(node.marks ?? null)) {
		last.text = `${last.text ?? ''}${node.text ?? ''}`;
		return;
	}
	result.push(node);
}

/** The inline content of HTML nodes: texts with their marks, line breaks; a block met inside is read as its text. */
function inlineNodes(nodes: HtmlNode[], marks: AdfMark[] = []): AdfNode[] {
	const result: AdfNode[] = [];
	for (const node of nodes) {
		if (typeof node === 'string') {
			if (!node) continue;
			const kept = canonicalMarks(marks);
			pushInline(result, kept ? { type: 'text', text: node, marks: kept } : { type: 'text', text: node });
			continue;
		}
		if (node.tag === 'br') {
			result.push({ type: 'hardBreak' });
			continue;
		}
		if (node.tag === 'img' || node.tag === 'hr') continue;
		const mark = markOfElement(node);
		for (const child of inlineNodes(node.children, mark ? [...marks, mark] : marks)) pushInline(result, child);
	}
	return result;
}

function textContent(nodes: HtmlNode[]): string {
	return nodes.map((node) => (typeof node === 'string' ? node : node.tag === 'br' ? '\n' : textContent(node.children))).join('');
}

function paragraph(content: AdfNode[]): AdfNode {
	return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

/** The blocks a list item or a quote may hold in ADF. */
const NESTED_BLOCK_TYPES: readonly string[] = ['paragraph', 'bulletList', 'orderedList', 'codeBlock'];

/**
 * The blocks of a list item or a quote: one ADF does not allow there (a heading, a table, a quote in a quote) becomes a
 * paragraph of its text, its lines kept as line breaks, so no word is lost; one without text (a rule) goes.
 */
function nestedBlocks(blocks: AdfNode[]): AdfNode[] {
	return blocks.flatMap((block) => {
		if (NESTED_BLOCK_TYPES.includes(block.type)) return [block];
		const lines = adfToText(block)
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean);
		if (!lines.length) return [];
		return [paragraph(lines.flatMap((text, index): AdfNode[] => (index ? [{ type: 'hardBreak' }, { type: 'text', text }] : [{ type: 'text', text }])))];
	});
}

/** Whether a run of inline HTML is only the whitespace between blocks. */
function isBlank(nodes: HtmlNode[]): boolean {
	return nodes.every((node) => typeof node === 'string' && !node.trim());
}

/** The block content of HTML nodes; inline content met at block level becomes a paragraph of its own. */
function blockNodes(nodes: HtmlNode[], context: 'doc' | 'quote' | 'cell' = 'doc'): AdfNode[] {
	const blocks: AdfNode[] = [];
	let inline: HtmlNode[] = [];
	const flush = () => {
		if (inline.length && !isBlank(inline)) {
			const content = inlineNodes(inline);
			if (content.length) blocks.push(paragraph(content));
		}
		inline = [];
	};
	for (const node of nodes) {
		if (!isBlockElement(node)) {
			inline.push(node);
			continue;
		}
		flush();
		blocks.push(...blockOf(node, context));
	}
	flush();
	return blocks;
}

function listItemsOf(element: HtmlElement): AdfNode[] {
	const items: AdfNode[] = [];
	for (const child of element.children) {
		if (typeof child === 'string') {
			if (child.trim()) items.push({ type: 'listItem', content: [paragraph(inlineNodes([child]))] });
			continue;
		}
		if (child.tag !== 'li') {
			// A list inside a list without its item, or inline content: an item of its own.
			const content = blockNodes([child]);
			if (content.length) items.push({ type: 'listItem', content: content[0].type === 'paragraph' ? content : [paragraph([]), ...content] });
			continue;
		}
		const content = nestedBlocks(blockNodes(child.children));
		// An item starts with a paragraph (ADF requires it).
		items.push({ type: 'listItem', content: content.length && content[0].type === 'paragraph' ? content : [paragraph([]), ...content] });
	}
	return items;
}

function rowsOf(element: HtmlElement): AdfNode[] {
	const rows: AdfNode[] = [];
	for (const child of element.children) {
		if (typeof child === 'string') continue;
		if (child.tag === 'thead' || child.tag === 'tbody' || child.tag === 'tfoot') {
			rows.push(...rowsOf(child));
			continue;
		}
		if (child.tag !== 'tr') continue;
		const cells = child.children
			.filter((cell): cell is HtmlElement => typeof cell !== 'string' && (cell.tag === 'th' || cell.tag === 'td'))
			.map((cell) => {
				const attrs: Record<string, unknown> = {};
				const colspan = Number(cell.attrs['colspan']);
				const rowspan = Number(cell.attrs['rowspan']);
				if (Number.isInteger(colspan) && colspan > 1) attrs['colspan'] = colspan;
				if (Number.isInteger(rowspan) && rowspan > 1) attrs['rowspan'] = rowspan;
				const content = blockNodes(cell.children, 'cell');
				return { type: cell.tag === 'th' ? 'tableHeader' : 'tableCell', ...(Object.keys(attrs).length ? { attrs } : {}), content: content.length ? content : [paragraph([])] } as AdfNode;
			});
		if (cells.length) rows.push({ type: 'tableRow', content: cells });
	}
	return rows;
}

function blockOf(element: HtmlElement, context: 'doc' | 'quote' | 'cell'): AdfNode[] {
	const level = HEADING_TAGS[element.tag];
	if (level) {
		const content = inlineNodes(element.children);
		// A quote holds no heading in ADF: the heading's text is kept, strong.
		if (context === 'quote') return [paragraph(inlineNodes(element.children, [{ type: 'strong' }]))];
		return [content.length ? { type: 'heading', attrs: { level }, content } : { type: 'heading', attrs: { level } }];
	}
	switch (element.tag) {
		case 'p':
			return [paragraph(inlineNodes(element.children))];
		case 'ul':
			return [{ type: 'bulletList', content: listItemsOf(element) }].filter((list) => list.content.length);
		case 'ol': {
			const start = Number(element.attrs['start']);
			const list: AdfNode = { type: 'orderedList', content: listItemsOf(element) };
			if (Number.isInteger(start) && start > 1) list.attrs = { order: start };
			return list.content?.length ? [list] : [];
		}
		case 'li':
			return blockNodes(element.children, context);
		case 'pre': {
			const text = textContent(element.children);
			return [text ? { type: 'codeBlock', content: [{ type: 'text', text }] } : { type: 'codeBlock' }];
		}
		case 'blockquote': {
			const content = nestedBlocks(blockNodes(element.children, 'quote'));
			return content.length ? [{ type: 'blockquote', content }] : [];
		}
		case 'hr':
			return context === 'doc' ? [{ type: 'rule' }] : [];
		case 'table': {
			if (context !== 'doc') return [paragraph(inlineNodes([textContent(element.children)]))];
			const rows = rowsOf(element);
			return rows.length ? [{ type: 'table', content: rows }] : [];
		}
		case 'colgroup':
			return [];
		default:
			// A container (`div`, `section`, a stray cell or row): its blocks.
			return blockNodes(element.children, context);
	}
}

/** The task store's HTML as a document; null for an empty description (it clears the issue's). */
export function htmlToAdf(html: string | null | undefined): AdfDocument | null {
	if (typeof html !== 'string' || !html.trim()) return null;
	const content = blockNodes(parseHtml(html));
	const doc: AdfDocument = { type: 'doc', version: 1, content };
	return adfToHtml(doc) === null ? null : doc;
}

/**
 * A task description as it reads after a trip to Jira and back: what the platform's value is compared with when the
 * issue's value is Jira's reading of it.
 */
export function canonicalHtml(html: string | null | undefined): string | null {
	if (typeof html !== 'string' || !html.trim()) return null;
	return adfToHtml(htmlToAdf(html));
}

/** A plain text (a comment the platform keeps as text) as a document: one paragraph per line. */
export function textToAdf(text: string): AdfDocument {
	const lines = text.split(/\r?\n/);
	const content = lines.map((line) => paragraph(line ? [{ type: 'text', text: line }] : []));
	return { type: 'doc', version: 1, content };
}
