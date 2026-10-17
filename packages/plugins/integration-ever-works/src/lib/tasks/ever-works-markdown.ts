/**
 * Rich text between Ever Works (Markdown / plain text: task descriptions and task chat) and Gauzy
 * (sanitised rich HTML: `task.description`, comments), plan 01 §7. Pure functions, no dependencies.
 *
 * Both directions cover what people and agents write in Ever Works and what Gauzy's editor produces
 * (`RICH_HTML_SANITIZE_OPTIONS`): paragraphs and line breaks, headings, emphasis, strikethrough, inline
 * code and code blocks, links and images (only `http(s)` and `mailto` targets), bullet, numbered and
 * nested lists, quotes, rules and tables. Anything else degrades to its text; nothing is executed or
 * fetched. Gauzy sanitises the HTML again on every write.
 *
 * The conversion is deterministic, so a value converted once converts to itself again: the engine
 * compares each side with its own last-synced value (plan 01 principle 4, lossy fields never flap).
 */

const HTML_ESCAPES: Readonly<Record<string, string>> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text as HTML text (also safe inside a double-quoted attribute). */
export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** A link or image target Gauzy and Ever Works both accept: absolute `http(s)`, or `mailto` for links. */
export function isSafeUrl(url: string, allowMailto = true): boolean {
	const value = url.trim();
	if (value.length > 2048) return false;
	return /^https?:\/\/[^\s<>"']+$/i.test(value) || (allowMailto && /^mailto:[^\s<>"']+$/i.test(value));
}

/** Line endings, trailing spaces and runs of blank lines made uniform, so equal texts compare equal. */
export function normaliseMarkdown(markdown: string | null | undefined): string {
	return String(markdown ?? '')
		.replace(/\u0000/g, '')
		.replace(/\r\n?/g, '\n')
		.replace(/[ \t]+$/gm, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

// ── Markdown → HTML ──────────────────────────────────────────────────────────────────────────────

const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)])(?: +(.*))?$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const HEADING = /^ {0,3}(#{1,6})(?: +(.*?))?(?: +#+)? *$/;
const RULE = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const QUOTE = /^ {0,3}> ?/;
const TABLE_SEPARATOR = /^ *\|? *:?-+:? *(?:\| *:?-+:? *)*\|? *$/;

const indentOf = (line: string) => line.length - line.replace(/^ +/, '').length;
const expandTabs = (line: string) => line.replace(/\t/g, '    ');

function isTableStart(lines: ReadonlyArray<string>, index: number): boolean {
	const header = lines[index];
	const separator = lines[index + 1];
	return !!header && !!separator && header.includes('|') && separator.includes('|') && separator.includes('-') && TABLE_SEPARATOR.test(separator);
}

/** Whether the line starts a block other than a paragraph (it ends a paragraph above it). */
function startsBlock(lines: ReadonlyArray<string>, index: number): boolean {
	const line = lines[index] ?? '';
	return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || LIST_ITEM.test(line) || isTableStart(lines, index);
}

/** Splits a table row into its cells (a `\|` stays inside the cell). */
function cellsOf(row: string): string[] {
	const trimmed = row.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
	return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

/**
 * Inline text longer than this is written as plain (escaped) text. Together with the bounded spans below it
 * keeps every inline pattern linear in practice: a crafted description cannot make the regexes rescan it
 * quadratically and stall the sync (ReDoS).
 */
export const INLINE_FORMAT_LIMIT = 20_000;

/** Inline Markdown → HTML: code spans, escapes, images, links, bare links, then emphasis on the escaped rest. */
function renderInline(source: string): string {
	if (source.length > INLINE_FORMAT_LIMIT) return escapeHtml(source);
	const slots: string[] = [];
	const hold = (html: string) => `\u0000${slots.push(html) - 1}\u0000`;
	let text = source;
	// Code spans first: nothing inside them is markup. A backtick after an odd run of backslashes is escaped
	// and never opens one (the escape is read below), so the escaped backticks of plain text read back as
	// backticks; after an even run the backslashes escape each other and the span opens.
	text = text.replace(/(?<!(?:^|[^\\])\\(?:\\\\)*)(`{1,16})(?!`)([\s\S]{0,4000}?[^`])\1(?!`)/g, (_match, _ticks: string, code: string) =>
		hold(`<code>${escapeHtml(/^ [\s\S]* $/.test(code) && code.trim() ? code.slice(1, -1) : code)}</code>`)
	);
	// A backslash keeps the next punctuation character literal.
	text = text.replace(/\\([\\`*_{}[\]()#+\-.!~|<>])/g, (_match, char: string) => hold(escapeHtml(char)));
	text = text.replace(/!\[([^\]\n]{0,500})\]\( *<?([^\s)>]{1,2048})>?(?: +"[^"\n]{0,500}")? *\)/g, (match, alt: string, src: string) =>
		isSafeUrl(src, false) ? hold(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`) : match
	);
	text = text.replace(/\[([^\]\n]{1,500})\]\( *<?([^\s)>]{1,2048})>?(?: +"[^"\n]{0,500}")? *\)/g, (match, label: string, href: string) =>
		isSafeUrl(href) ? hold(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${renderEmphasis(escapeHtml(label))}</a>`) : match
	);
	text = text.replace(/<((?:https?:\/\/|mailto:)[^\s<>]{1,2048})>/gi, (match, href: string) =>
		isSafeUrl(href) ? hold(`<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(href)}</a>`) : match
	);
	let html = renderEmphasis(escapeHtml(text));
	// Slots can hold slots (a code span inside a link label): restore until none is left.
	for (let pass = 0; pass < 4 && html.includes('\u0000'); pass++) {
		html = html.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => slots[Number(index)] ?? '');
	}
	return html.replace(/\u0000/g, '');
}

/**
 * A paragraph's lines (a line break is a `<br>`): as one text, so spans may cross a line break, unless that
 * text is longer than the inline limit — then line by line, so a long paragraph keeps its formatting.
 */
function renderLines(lines: ReadonlyArray<string>): string {
	const text = lines.join('\n');
	return text.length <= INLINE_FORMAT_LIMIT ? renderInline(text).replace(/\n/g, '<br>') : lines.map(renderInline).join('<br>');
}

/**
 * Emphasis on already-escaped text. `_` only at word boundaries, so `snake_case_name` stays as it is. A span
 * is at most 1000 characters (bounded: an unmatched opener cannot rescan the text).
 */
function renderEmphasis(html: string): string {
	return html
		.replace(/~~(?=\S)([\s\S]{0,1000}?\S)~~/g, '<s>$1</s>')
		.replace(/\*\*(?=\S)([\s\S]{0,1000}?\S)\*\*/g, '<strong>$1</strong>')
		.replace(/(?<![\p{L}\p{N}_])__(?=\S)([\s\S]{0,1000}?\S)__(?![\p{L}\p{N}_])/gu, '<strong>$1</strong>')
		.replace(/\*(?=[^\s*])([\s\S]{0,1000}?[^\s*])\*/g, '<em>$1</em>')
		.replace(/(?<![\p{L}\p{N}_])_(?=[^\s_])([\s\S]{0,1000}?[^\s_])_(?![\p{L}\p{N}_])/gu, '<em>$1</em>');
}

/** A list starting at `start`: its HTML and the index of the first line after it. */
function renderList(lines: ReadonlyArray<string>, start: number, depth: number): [string, number] {
	const first = LIST_ITEM.exec(lines[start]) as RegExpExecArray;
	const indent = (first[1] ?? '').length;
	const ordered = /\d/.test(first[2] ?? '');
	const items: string[][] = [];
	let contentIndent = indent + 2;
	let index = start;
	while (index < lines.length) {
		const line = lines[index];
		const item = LIST_ITEM.exec(line);
		if (item && (item[1] ?? '').length === indent && /\d/.test(item[2] ?? '') === ordered && !RULE.test(line)) {
			contentIndent = indent + (item[2] ?? '').length + 1;
			items.push([item[3] ?? '']);
			index++;
			continue;
		}
		const current = items[items.length - 1];
		if (!line.trim()) {
			// A blank line ends the list unless the list goes on after it (an indented line or a sibling item).
			const next = lines[index + 1];
			const nextItem = next !== undefined ? LIST_ITEM.exec(next) : null;
			if (next !== undefined && next.trim() && (indentOf(next) >= contentIndent || (nextItem && (nextItem[1] ?? '').length === indent))) {
				current.push('');
				index++;
				continue;
			}
			break;
		}
		if (indentOf(line) >= contentIndent || (indentOf(line) > indent && LIST_ITEM.test(line))) {
			current.push(line.slice(Math.min(indentOf(line), contentIndent)));
			index++;
			continue;
		}
		if (!startsBlock(lines, index) && current[current.length - 1]?.trim()) {
			current.push(line.trim()); // a lazy continuation of the item's paragraph
			index++;
			continue;
		}
		break;
	}
	const tag = ordered ? 'ol' : 'ul';
	const startNumber = ordered ? parseInt(first[2] ?? '1', 10) : 1;
	const attributes = ordered && startNumber !== 1 ? ` start="${startNumber}"` : '';
	const body = items
		.map((item) => {
			const html = renderBlocks(item, depth + 1);
			// A one-paragraph item is written without its <p> (a tight list).
			const tight = html.length === 1 && /^<p>[\s\S]*<\/p>$/.test(html[0]) ? html[0].slice(3, -4) : html.join('');
			return `<li>${tight}</li>`;
		})
		.join('');
	return [`<${tag}${attributes}>${body}</${tag}>`, index];
}

function renderBlocks(source: ReadonlyArray<string>, depth: number): string[] {
	const lines = source.map(expandTabs);
	const out: string[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index];
		if (!line.trim()) {
			index++;
			continue;
		}
		const fence = FENCE.exec(line);
		if (fence) {
			const marker = fence[1] ?? '```';
			const closing = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},} *$`);
			const body: string[] = [];
			index++;
			while (index < lines.length && !closing.test(lines[index])) body.push(lines[index++]);
			index++; // the closing fence (or the end of the text)
			out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`);
			continue;
		}
		const heading = HEADING.exec(line);
		if (heading) {
			const level = (heading[1] ?? '#').length;
			out.push(`<h${level}>${renderInline(heading[2] ?? '')}</h${level}>`);
			index++;
			continue;
		}
		if (RULE.test(line)) {
			out.push('<hr>');
			index++;
			continue;
		}
		if (QUOTE.test(line)) {
			const quoted: string[] = [];
			while (index < lines.length && QUOTE.test(lines[index])) quoted.push(lines[index++].replace(QUOTE, ''));
			const inner = depth < 8 ? renderBlocks(quoted, depth + 1).join('') : `<p>${renderLines(quoted)}</p>`;
			out.push(`<blockquote>${inner}</blockquote>`);
			continue;
		}
		if (LIST_ITEM.test(line) && depth < 8) {
			const [html, next] = renderList(lines, index, depth);
			out.push(html);
			index = next;
			continue;
		}
		if (isTableStart(lines, index)) {
			const header = cellsOf(lines[index]);
			index += 2;
			const rows: string[][] = [];
			while (index < lines.length && lines[index].trim() && lines[index].includes('|')) rows.push(cellsOf(lines[index++]));
			const cell = (tag: 'th' | 'td', value: string) => `<${tag}>${renderInline(value)}</${tag}>`;
			const head = `<thead><tr>${header.map((value) => cell('th', value)).join('')}</tr></thead>`;
			const body = rows.length ? `<tbody>${rows.map((row) => `<tr>${header.map((_h, i) => cell('td', row[i] ?? '')).join('')}</tr>`).join('')}</tbody>` : '';
			out.push(`<table>${head}${body}</table>`);
			continue;
		}
		const paragraph: string[] = [];
		while (index < lines.length && lines[index].trim() && (!paragraph.length || !startsBlock(lines, index))) paragraph.push(lines[index++].trim());
		out.push(`<p>${renderLines(paragraph)}</p>`);
	}
	return out;
}

/** Ever Works Markdown (or plain text) → Gauzy rich HTML. Empty in, empty out. */
export function markdownToHtml(markdown: string | null | undefined): string {
	const text = normaliseMarkdown(markdown);
	if (!text) return '';
	return renderBlocks(text.split('\n'), 0).join('');
}

// ── HTML → Markdown ──────────────────────────────────────────────────────────────────────────────

/** A parsed HTML element (also read by the docs sync, which walks it into TipTap nodes). */
export interface HtmlNode {
	tag: string;
	attributes: Record<string, string>;
	children: Array<HtmlNode | string>;
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'col', 'wbr']);
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'col']);
const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
	return text.replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z]{2,8});/gi, (match, entity: string) => {
		if (entity[0] === '#') {
			const code = entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
		}
		return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
	});
}

/** A tolerant parser for the HTML Gauzy stores (already sanitised, so well formed in practice). */
export function parseHtml(html: string): HtmlNode {
	const root: HtmlNode = { tag: '#root', attributes: {}, children: [] };
	const stack: HtmlNode[] = [root];
	const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>|([^<]+|<)/g;
	let match: RegExpExecArray | null;
	while ((match = token.exec(html))) {
		const [whole, closing, rawTag, rawAttributes, selfClosing, text] = match;
		const top = stack[stack.length - 1];
		if (text !== undefined) {
			top.children.push(decodeEntities(text));
			continue;
		}
		if (!rawTag || whole.startsWith('<!--')) continue;
		const tag = rawTag.toLowerCase();
		if (closing) {
			const at = stack.map((node) => node.tag).lastIndexOf(tag);
			if (at > 0) stack.length = at;
			continue;
		}
		const attributes: Record<string, string> = {};
		const attribute = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
		let pair: RegExpExecArray | null;
		while ((pair = attribute.exec(rawAttributes ?? ''))) {
			attributes[(pair[1] ?? '').toLowerCase()] = decodeEntities(pair[2] ?? pair[3] ?? pair[4] ?? '');
		}
		const node: HtmlNode = { tag, attributes, children: [] };
		top.children.push(node);
		if (!VOID_TAGS.has(tag) && !selfClosing) stack.push(node);
	}
	return root;
}

/** The text of a parsed node (`<br>` → a line break). */
export function textContent(node: HtmlNode | string): string {
	if (typeof node === 'string') return node;
	if (node.tag === 'br') return '\n';
	return node.children.map(textContent).join('');
}

/** Escapes what Markdown would read as markup inside plain text. */
function escapeMarkdownText(text: string): string {
	return text
		.replace(/\\(?=[\\`*_{}[\]()#+\-.!~|<>])/g, '\\\\')
		.replace(/[`*[]/g, (char) => `\\${char}`)
		.replace(/~(?=~)/g, '\\~')
		.replace(/(?<![\p{L}\p{N}_])_|_(?![\p{L}\p{N}_])/gu, '\\_')
		.replace(/<(?=[a-zA-Z/!])/g, '\\<');
}

/** Wraps inline Markdown in a delimiter, keeping surrounding spaces outside it (`** bold**` is not bold). */
function wrapInline(delimiter: string, inner: string): string {
	const core = inner.trim();
	if (!core) return inner;
	const lead = inner.slice(0, inner.length - inner.trimStart().length);
	const trail = inner.slice(inner.trimEnd().length);
	return `${lead}${delimiter}${core}${delimiter}${trail}`;
}

function codeSpan(code: string): string {
	const longest = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
	const ticks = '`'.repeat(longest + 1);
	const pad = code.startsWith('`') || code.endsWith('`') ? ' ' : '';
	return `${ticks}${pad}${code}${pad}${ticks}`;
}

function renderInlineNodes(nodes: ReadonlyArray<HtmlNode | string>): string {
	return nodes
		.map((node) => {
			if (typeof node === 'string') return escapeMarkdownText(node.replace(/\s+/g, ' '));
			const inner = () => renderInlineNodes(node.children);
			switch (node.tag) {
				case 'br':
					return '\n';
				case 'strong':
				case 'b':
					return wrapInline('**', inner());
				case 'em':
				case 'i':
					return wrapInline('*', inner());
				case 's':
				case 'del':
				case 'strike':
					return wrapInline('~~', inner());
				case 'code': {
					const code = textContent(node).replace(/\n/g, ' ');
					return code ? codeSpan(code) : '';
				}
				case 'a': {
					const href = (node.attributes['href'] ?? '').trim();
					const label = inner();
					if (!isSafeUrl(href)) return label;
					if (!label.trim() || textContent(node).trim() === href) return `<${href}>`;
					return `[${label.replace(/\n/g, ' ')}](${href.replace(/[()]/g, (char) => encodeURIComponent(char))})`;
				}
				case 'img': {
					const src = (node.attributes['src'] ?? '').trim();
					return isSafeUrl(src, false) ? `![${escapeMarkdownText(node.attributes['alt'] ?? '')}](${src.replace(/[()]/g, (char) => encodeURIComponent(char))})` : '';
				}
				default:
					return BLOCK_TAGS.has(node.tag) ? renderBlockNodes(node.children).join('\n\n') : inner();
			}
		})
		.join('');
}

/** A line of text that Markdown would read as a block marker (a heading, quote, list item or rule), escaped. */
function escapeLineStart(line: string): string {
	if (/^#{1,6}( |$)/.test(line) || line.startsWith('>') || /^[-+]( |$)/.test(line) || RULE.test(line)) return `\\${line}`;
	const ordered = /^(\d{1,9})([.)])( |$)/.exec(line);
	return ordered ? `${ordered[1]}\\${line.slice((ordered[1] ?? '').length)}` : line;
}

/** A paragraph's lines, trimmed, with a leading block marker escaped. */
function paragraphOf(markdown: string): string {
	return markdown
		.split('\n')
		.map((line) => escapeLineStart(line.trim()))
		.join('\n')
		.trim();
}

function renderListNode(node: HtmlNode, depth: number): string {
	const ordered = node.tag === 'ol';
	let number = ordered ? parseInt(node.attributes['start'] ?? '1', 10) || 1 : 1;
	const items = node.children.filter((child): child is HtmlNode => typeof child !== 'string' && child.tag === 'li');
	return items
		.map((item) => {
			const marker = ordered ? `${number++}. ` : '- ';
			const pad = ' '.repeat(marker.length);
			const blocks = depth < 8 ? renderBlockNodes(item.children, depth + 1) : [paragraphOf(renderInlineNodes(item.children))];
			// A nested list follows its item's text directly (a tight list); other blocks are separated by a blank line.
			const body = blocks.map((block, i) => (i === 0 ? block : (/^(- |\d{1,9}\. )/.test(block) ? '\n' : '\n\n') + block)).join('');
			return marker + body.split('\n').map((line, i) => (i === 0 || !line ? line : pad + line)).join('\n');
		})
		.join('\n');
}

function renderTableNode(node: HtmlNode): string {
	const rows: HtmlNode[] = [];
	const collect = (parent: HtmlNode) => {
		for (const child of parent.children) {
			if (typeof child === 'string') continue;
			if (child.tag === 'tr') rows.push(child);
			else if (child.tag === 'thead' || child.tag === 'tbody' || child.tag === 'tfoot') collect(child);
		}
	};
	collect(node);
	if (!rows.length) return '';
	const cells = rows.map((row) =>
		row.children
			.filter((cell): cell is HtmlNode => typeof cell !== 'string' && (cell.tag === 'th' || cell.tag === 'td'))
			.map((cell) => renderInlineNodes(cell.children).replace(/\n/g, ' ').replace(/\|/g, '\\|').trim())
	);
	const width = Math.max(1, ...cells.map((row) => row.length));
	const line = (row: string[]) => `| ${Array.from({ length: width }, (_v, i) => row[i] ?? '').join(' | ')} |`;
	const [header, ...body] = cells;
	return [line(header), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)].join('\n');
}

function renderBlockNode(node: HtmlNode, depth: number): string {
	switch (node.tag) {
		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6':
			return `${'#'.repeat(Number(node.tag[1]))} ${renderInlineNodes(node.children).replace(/\n/g, ' ').trim()}`.trimEnd();
		case 'hr':
			return '---';
		case 'pre': {
			const code = textContent(node).replace(/\n$/, '');
			const longest = Math.max(2, ...(code.match(/`{3,}/g) ?? []).map((run) => run.length));
			const fence = '`'.repeat(longest + 1);
			return `${fence}\n${code}\n${fence}`;
		}
		case 'blockquote': {
			const inner = depth < 8 ? renderBlockNodes(node.children, depth + 1).join('\n\n') : paragraphOf(renderInlineNodes(node.children));
			return inner
				.split('\n')
				.map((line) => (line ? `> ${line}` : '>'))
				.join('\n');
		}
		case 'ul':
		case 'ol':
			return renderListNode(node, depth);
		case 'table':
			return renderTableNode(node);
		case 'li':
			return renderListNode({ tag: 'ul', attributes: {}, children: [node] }, depth);
		case 'colgroup':
		case 'col':
		case 'thead':
		case 'tbody':
		case 'tfoot':
		case 'tr':
			return renderBlockNodes(node.children, depth).join('\n\n');
		default:
			// p, div
			return paragraphOf(renderInlineNodes(node.children));
	}
}

function renderBlockNodes(nodes: ReadonlyArray<HtmlNode | string>, depth = 0): string[] {
	const out: string[] = [];
	let inline: Array<HtmlNode | string> = [];
	const flush = () => {
		const text = paragraphOf(renderInlineNodes(inline));
		if (text) out.push(text);
		inline = [];
	};
	for (const node of nodes) {
		if (typeof node !== 'string' && BLOCK_TAGS.has(node.tag)) {
			flush();
			const block = renderBlockNode(node, depth);
			if (block.trim()) out.push(block);
		} else {
			inline.push(node);
		}
	}
	flush();
	return out;
}

/** Gauzy rich HTML → Ever Works Markdown. Empty in, empty out. */
export function htmlToMarkdown(html: string | null | undefined): string {
	const source = String(html ?? '').replace(/\u0000/g, '');
	if (!source.trim()) return '';
	return normaliseMarkdown(renderBlockNodes(parseHtml(source).children).join('\n\n'));
}
