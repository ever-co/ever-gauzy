// cspell:ignore wikilink wikilinks unfiled
import { createHash } from 'node:crypto';
import {
	escapeHtml,
	HtmlNode,
	isSafeUrl,
	markdownToHtml,
	normaliseMarkdown,
	parseHtml,
	textContent
} from '../tasks/ever-works-markdown';

/**
 * Document bodies between Ever Works (Markdown with `[[path]]` wikilinks: the Knowledge Base
 * `body`) and Gauzy Docs (a PAGE's canonical TipTap JSON `contentJson`, plus its `contentHtml` render
 * cache), plan 05 §2. Pure functions, no dependencies.
 *
 * - **Markdown → TipTap.** Markdown goes to HTML through the integration's own converter (the one the
 *   task sync uses: bounded spans, only `http(s)` / `mailto` targets), and that HTML is walked into
 *   nodes of the Docs editor's schema (`tiptap-schema.validator.ts` of the Docs plugin): paragraphs,
 *   headings, quotes, bullet / numbered / task lists, code blocks, rules, line breaks, tables, images
 *   and the bold, italic, strike, code and link marks. A wikilink whose target is a synced Gauzy
 *   document becomes a `documentMention` (the editor's `+` cross-link); any other stays literal
 *   `[[path]]` text. Nothing else is produced, so the result always loads in the editor.
 * - **TipTap → Markdown.** Every node type of the schema is written: what Markdown has no syntax for
 *   (underline, colours, callouts, details, embeds) degrades to its text or a plain link; a
 *   `documentMention` of a synced document becomes `[[its path]]`, else its label.
 * - **TipTap → HTML** for the render cache: escaped text, the same safe link and image rule.
 *
 * Each direction is deterministic. The sync compares each side with its own last-synced value (the
 * hashes below), so a construct one side cannot hold exactly never flaps between them.
 */

/** A TipTap (ProseMirror JSON) mark. */
export interface TiptapMark {
	type: string;
	attrs?: Record<string, unknown>;
}

/** A TipTap (ProseMirror JSON) node. */
export interface TiptapNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: TiptapNode[];
	marks?: TiptapMark[];
	text?: string;
}

/** The Gauzy document a `[[path]]` wikilink points at, when that document is synced. */
export interface EverWorksWikilinkTarget {
	documentId: string;
	label: string;
}

export interface MarkdownToDocumentOptions {
	/** The synced Gauzy document of a wikilink path, or `null` (the wikilink stays literal text). */
	resolveWikilink?: (path: string) => EverWorksWikilinkTarget | null;
}

export interface DocumentToMarkdownOptions {
	/** The Ever Works path of a mentioned Gauzy document, when it is synced (`[[path]]`), else `null`. */
	resolveMention?: (documentId: string) => string | null;
}

/** A wikilink: `[[path]]` (no brackets or line breaks inside, at most 512 characters, the contract's path limit). */
const WIKILINK = /\[\[([^[\]\n]{1,512})\]\]/g;

/**
 * Past this many nodes a document is written as one code block of its Markdown. The Docs editor
 * refuses more than 50 000 nodes, and a document that large is read rather than edited.
 */
export const DOCUMENT_NODE_LIMIT = 40_000;

/** The character the Docs editor's document mentions are typed with. */
const DOCUMENT_MENTION_CHAR = '+';

/** The fingerprint the sync compares a body with: SHA-256 of its normalised Markdown. */
export function markdownHash(markdown: string | null | undefined): string {
	return createHash('sha256').update(normaliseMarkdown(markdown)).digest('hex');
}

// ── Markdown → TipTap ────────────────────────────────────────────────────────────────────────────

/**
 * Ever Works Markdown → a Docs PAGE: the TipTap document and its HTML render cache. Empty Markdown gives
 * an empty page (one empty paragraph, as the editor creates one).
 */
export function markdownToDocument(
	markdown: string | null | undefined,
	options: MarkdownToDocumentOptions = {}
): { contentJson: TiptapNode; contentHtml: string } {
	const text = normaliseMarkdown(markdown);
	const blocks = text ? blocksOf(parseHtml(markdownToHtml(text)).children, options) : [];
	let doc: TiptapNode = { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] };
	if (countNodes(doc) > DOCUMENT_NODE_LIMIT) {
		doc = { type: 'doc', content: [{ type: 'codeBlock', attrs: { language: 'markdown' }, content: [{ type: 'text', text }] }] };
	}
	return { contentJson: doc, contentHtml: documentToHtml(doc) };
}

function countNodes(node: TiptapNode): number {
	let count = 1;
	for (const child of node.content ?? []) count += countNodes(child);
	return count;
}

type Inline = TiptapNode;

/** The block nodes of a run of parsed HTML (inline runs between blocks become paragraphs). */
function blocksOf(nodes: ReadonlyArray<HtmlNode | string>, options: MarkdownToDocumentOptions): TiptapNode[] {
	const out: TiptapNode[] = [];
	let inline: Inline[] = [];
	const flush = () => {
		out.push(...paragraphsOf(inline));
		inline = [];
	};
	for (const node of nodes) {
		const block = typeof node === 'string' ? null : blockOf(node, options);
		if (block) {
			flush();
			out.push(...block);
		} else {
			inline.push(...inlineOf(node, [], options));
		}
	}
	flush();
	return out;
}

/** A paragraph of inline nodes; a block image inside it splits it (images are block nodes in the editor). */
function paragraphsOf(inline: Inline[]): TiptapNode[] {
	const out: TiptapNode[] = [];
	let run: Inline[] = [];
	const flush = () => {
		const content = trimBreaks(run);
		if (content.length) out.push({ type: 'paragraph', content });
		run = [];
	};
	for (const node of inline) {
		if (node.type === 'image') {
			flush();
			out.push(node);
		} else run.push(node);
	}
	flush();
	return out;
}

/** Drops leading and trailing line breaks and whitespace-only text at the edges of a paragraph. */
function trimBreaks(nodes: Inline[]): Inline[] {
	let start = 0;
	let end = nodes.length;
	while (start < end && (nodes[start].type === 'hardBreak' || (nodes[start].type === 'text' && !nodes[start].text?.trim()))) start++;
	while (end > start && (nodes[end - 1].type === 'hardBreak' || (nodes[end - 1].type === 'text' && !nodes[end - 1].text?.trim()))) end--;
	return nodes.slice(start, end);
}

/** The block nodes of one element, or `null` when it is an inline element. */
function blockOf(node: HtmlNode, options: MarkdownToDocumentOptions): TiptapNode[] | null {
	switch (node.tag) {
		case 'p':
		case 'div':
			return paragraphsOf(inlineChildren(node, [], options));
		case 'h1':
		case 'h2':
		case 'h3':
		case 'h4':
		case 'h5':
		case 'h6': {
			const content = trimBreaks(inlineChildren(node, [], options)).filter((child) => child.type !== 'image');
			return [{ type: 'heading', attrs: { level: Number(node.tag[1]) }, ...(content.length ? { content } : {}) }];
		}
		case 'pre': {
			const code = textContent(node).replace(/\n$/, '');
			return [{ type: 'codeBlock', attrs: { language: null }, ...(code ? { content: [{ type: 'text', text: code }] } : {}) }];
		}
		case 'hr':
			return [{ type: 'horizontalRule' }];
		case 'blockquote': {
			const content = blocksOf(node.children, options);
			return [{ type: 'blockquote', content: content.length ? content : [{ type: 'paragraph' }] }];
		}
		case 'ul':
		case 'ol':
			return [listOf(node, options)];
		case 'table':
			return tableOf(node, options);
		default:
			return null;
	}
}

/** A bullet, numbered or task list (a bullet list whose every item starts `[ ]` / `[x]`). */
function listOf(node: HtmlNode, options: MarkdownToDocumentOptions): TiptapNode {
	const items = node.children.filter((child): child is HtmlNode => typeof child !== 'string' && child.tag === 'li');
	const isTaskList = node.tag === 'ul' && items.length > 0 && items.every((item) => /^\[[ xX]\]( |$)/.test(leadingText(item)));
	if (isTaskList) {
		return {
			type: 'taskList',
			content: items.map((item) => {
				const checked = /^\[[xX]\]/.test(leadingText(item));
				return { type: 'taskItem', attrs: { checked }, content: itemContent(stripTaskMarker(item), options) };
			})
		};
	}
	const start = parseInt(node.attributes['start'] ?? '1', 10);
	return {
		type: node.tag === 'ol' ? 'orderedList' : 'bulletList',
		...(node.tag === 'ol' ? { attrs: { start: Number.isFinite(start) && start > 0 ? start : 1 } } : {}),
		content: items.map((item) => ({ type: 'listItem', content: itemContent(item, options) }))
	};
}

/** The text an item starts with (to recognise a task marker). */
function leadingText(item: HtmlNode): string {
	const first = item.children[0];
	if (first === undefined) return '';
	if (typeof first === 'string') return first;
	return first.tag === 'p' ? leadingText(first) : '';
}

/** The item without its `[ ]` / `[x]` marker. */
function stripTaskMarker(item: HtmlNode): HtmlNode {
	const [first, ...rest] = item.children;
	if (typeof first === 'string') return { ...item, children: [first.replace(/^\[[ xX]\] ?/, ''), ...rest] };
	if (first && first.tag === 'p') return { ...item, children: [stripTaskMarker(first), ...rest] };
	return item;
}

/** A list item's content: blocks, starting with a paragraph (the editor's list item schema). */
function itemContent(item: HtmlNode, options: MarkdownToDocumentOptions): TiptapNode[] {
	const content = blocksOf(item.children, options);
	if (!content.length || content[0].type !== 'paragraph') content.unshift({ type: 'paragraph' });
	return content;
}

/** A table: rows of header and body cells, each holding a paragraph. */
function tableOf(node: HtmlNode, options: MarkdownToDocumentOptions): TiptapNode[] {
	const rows: Array<{ cells: HtmlNode[] }> = [];
	const collect = (parent: HtmlNode) => {
		for (const child of parent.children) {
			if (typeof child === 'string') continue;
			if (child.tag === 'tr') rows.push({ cells: child.children.filter((cell): cell is HtmlNode => typeof cell !== 'string' && (cell.tag === 'th' || cell.tag === 'td')) });
			else if (child.tag === 'thead' || child.tag === 'tbody' || child.tag === 'tfoot') collect(child);
		}
	};
	collect(node);
	const kept = rows.filter((row) => row.cells.length);
	if (!kept.length) return [];
	return [
		{
			type: 'table',
			content: kept.map((row) => ({
				type: 'tableRow',
				content: row.cells.map((cell) => {
					const paragraph = paragraphsOf(inlineChildren(cell, [], options)).filter((block) => block.type === 'paragraph');
					return { type: cell.tag === 'th' ? 'tableHeader' : 'tableCell', content: paragraph.length ? paragraph : [{ type: 'paragraph' }] };
				})
			}))
		}
	];
}

function inlineChildren(node: HtmlNode, marks: TiptapMark[], options: MarkdownToDocumentOptions): Inline[] {
	return node.children.flatMap((child) => inlineOf(child, marks, options));
}

/** The inline nodes of a parsed node under the marks around it. */
function inlineOf(node: HtmlNode | string, marks: TiptapMark[], options: MarkdownToDocumentOptions): Inline[] {
	if (typeof node === 'string') return textNodes(node.replace(/\n/g, ' '), marks, options);
	const withMark = (mark: TiptapMark) => inlineChildren(node, addMark(marks, mark), options);
	switch (node.tag) {
		case 'br':
			return [{ type: 'hardBreak' }];
		case 'strong':
		case 'b':
			return withMark({ type: 'bold' });
		case 'em':
		case 'i':
			return withMark({ type: 'italic' });
		case 's':
		case 'del':
		case 'strike':
			return withMark({ type: 'strike' });
		case 'code': {
			// A code span holds no other formatting (a link around it is kept).
			const code = textContent(node).replace(/\n/g, ' ');
			const kept = marks.filter((mark) => mark.type === 'link');
			return code ? [{ type: 'text', text: code, marks: [...kept, { type: 'code' }] }] : [];
		}
		case 'a': {
			const href = (node.attributes['href'] ?? '').trim();
			if (!isSafeUrl(href)) return inlineChildren(node, marks, options);
			return withMark({ type: 'link', attrs: { href, target: '_blank', rel: 'noopener noreferrer nofollow' } });
		}
		case 'img': {
			const src = (node.attributes['src'] ?? '').trim();
			if (!isSafeUrl(src, false)) return [];
			const alt = node.attributes['alt'] ?? '';
			return [{ type: 'image', attrs: { src, alt: alt || null, title: null } }];
		}
		default: {
			const block = blockOf(node, options);
			// A block where only inline content may go (it does not happen in the converter's own HTML): its text.
			return block ? textNodes(textContent(node), marks, options) : inlineChildren(node, marks, options);
		}
	}
}

/** A mark set with one more mark (a mark of the same type is replaced: one link at a time). */
function addMark(marks: TiptapMark[], mark: TiptapMark): TiptapMark[] {
	return [...marks.filter((existing) => existing.type !== mark.type), mark];
}

/** Text with its marks, wikilinks of synced documents as document mentions. */
function textNodes(text: string, marks: TiptapMark[], options: MarkdownToDocumentOptions): Inline[] {
	if (!text) return [];
	const out: Inline[] = [];
	const push = (part: string) => {
		if (part) out.push({ type: 'text', text: part, ...(marks.length ? { marks: marks.map((mark) => ({ ...mark })) } : {}) });
	};
	let last = 0;
	if (options.resolveWikilink) {
		for (const match of text.matchAll(WIKILINK)) {
			const target = options.resolveWikilink((match[1] ?? '').trim());
			if (!target) continue;
			push(text.slice(last, match.index));
			out.push({ type: 'documentMention', attrs: { id: target.documentId, label: target.label, mentionSuggestionChar: DOCUMENT_MENTION_CHAR } });
			last = (match.index ?? 0) + match[0].length;
		}
	}
	push(text.slice(last));
	return out;
}

// ── TipTap → Markdown ────────────────────────────────────────────────────────────────────────────

/** A Docs PAGE (TipTap JSON; the SQLite text form is accepted) → Ever Works Markdown. */
export function documentToMarkdown(contentJson: unknown, options: DocumentToMarkdownOptions = {}): string {
	const doc = parseContentJson(contentJson);
	if (!doc) return '';
	return normaliseMarkdown(blocksToMarkdown(doc.content ?? [], options, 0).join('\n\n'));
}

/** The TipTap JSON of a PAGE (a string on SQLite), or `null`. */
export function parseContentJson(value: unknown): TiptapNode | null {
	let parsed = value;
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value);
		} catch {
			return null;
		}
	}
	return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as TiptapNode).type === 'string' ? (parsed as TiptapNode) : null;
}

/** Nesting deeper than this is written as text (as the Markdown converter caps it). */
const MAX_DEPTH = 8;

function blocksToMarkdown(nodes: ReadonlyArray<TiptapNode>, options: DocumentToMarkdownOptions, depth: number): string[] {
	const out: string[] = [];
	let inline: TiptapNode[] = [];
	const flush = () => {
		const text = paragraphText(inlineToMarkdown(inline, options));
		if (text) out.push(text);
		inline = [];
	};
	for (const node of nodes) {
		if (isInlineNode(node)) {
			inline.push(node);
			continue;
		}
		flush();
		const block = blockToMarkdown(node, options, depth);
		if (block.trim()) out.push(block);
	}
	flush();
	return out;
}

const INLINE_TYPES = new Set(['text', 'hardBreak', 'emoji', 'inlineMath', 'employeeMention', 'documentMention']);
const isInlineNode = (node: TiptapNode) => INLINE_TYPES.has(node.type);

function blockToMarkdown(node: TiptapNode, options: DocumentToMarkdownOptions, depth: number): string {
	const children = node.content ?? [];
	const nested = () => (depth < MAX_DEPTH ? blocksToMarkdown(children, options, depth + 1) : [paragraphText(inlineToMarkdown(flattenInline(children), options))]);
	switch (node.type) {
		case 'paragraph':
			return paragraphText(inlineToMarkdown(children, options));
		case 'heading': {
			const level = Math.min(Math.max(Number(node.attrs?.['level']) || 1, 1), 6);
			const text = inlineToMarkdown(children, options).replace(/\n/g, ' ').trim();
			return text ? `${'#'.repeat(level)} ${text}` : '';
		}
		case 'codeBlock': {
			const code = flattenText(children);
			const longest = Math.max(2, ...(code.match(/`{3,}/g) ?? []).map((run) => run.length));
			const fence = '`'.repeat(longest + 1);
			const attribute = node.attrs?.['language'];
			const language = typeof attribute === 'string' && /^[\w+#.-]{1,32}$/.test(attribute) ? attribute : '';
			return `${fence}${language}\n${code}\n${fence}`;
		}
		case 'blockMath': {
			const latex = String(node.attrs?.['latex'] ?? '').trim();
			return latex ? `$$\n${latex}\n$$` : '';
		}
		case 'horizontalRule':
			return '---';
		case 'blockquote':
		case 'callout':
			return quote(nested().join('\n\n'));
		case 'details':
			return nested().join('\n\n');
		case 'detailsSummary': {
			const summary = inlineToMarkdown(children, options).replace(/\n/g, ' ').trim();
			return summary ? `**${summary}**` : '';
		}
		case 'detailsContent':
			return nested().join('\n\n');
		case 'bulletList':
		case 'orderedList':
		case 'taskList':
			return listToMarkdown(node, options, depth);
		case 'listItem':
		case 'taskItem':
			return listToMarkdown({ type: node.type === 'taskItem' ? 'taskList' : 'bulletList', content: [node] }, options, depth);
		case 'table':
			return tableToMarkdown(node, options);
		case 'image': {
			const src = String(node.attrs?.['src'] ?? '').trim();
			const alt = String(node.attrs?.['alt'] ?? '');
			return isSafeUrl(src, false) ? `![${escapeText(alt)}](${encodeParens(src)})` : escapeText(alt);
		}
		case 'youtube':
		case 'embedCard': {
			const url = String(node.attrs?.[node.type === 'youtube' ? 'src' : 'url'] ?? '').trim();
			const title = String(node.attrs?.['title'] ?? '').trim();
			if (!isSafeUrl(url)) return escapeText(title);
			return title ? `[${escapeText(title)}](${encodeParens(url)})` : `<${url}>`;
		}
		case 'fileAttachment':
			return escapeText(String(node.attrs?.['name'] ?? ''));
		default:
			// An unknown block (a newer editor extension): its content, so no text is lost.
			return nested().join('\n\n');
	}
}

function listToMarkdown(node: TiptapNode, options: DocumentToMarkdownOptions, depth: number): string {
	const ordered = node.type === 'orderedList';
	let number = ordered ? Math.max(1, Number(node.attrs?.['start']) || 1) : 1;
	return (node.content ?? [])
		.map((item) => {
			const task = node.type === 'taskList' || item.type === 'taskItem';
			const marker = ordered ? `${number++}. ` : task ? `- [${item.attrs?.['checked'] ? 'x' : ' '}] ` : '- ';
			const pad = ' '.repeat(ordered ? marker.length : 2);
			const blocks = depth < MAX_DEPTH ? blocksToMarkdown(item.content ?? [], options, depth + 1) : [paragraphText(inlineToMarkdown(flattenInline(item.content ?? []), options))];
			// A nested list follows its item's text directly (a tight list); other blocks are separated by a blank line.
			const body = blocks.map((block, i) => (i === 0 ? block : (/^(- |\d{1,9}\. )/.test(block) ? '\n' : '\n\n') + block)).join('');
			return marker + body.split('\n').map((line, i) => (i === 0 || !line ? line : pad + line)).join('\n');
		})
		.join('\n');
}

function tableToMarkdown(node: TiptapNode, options: DocumentToMarkdownOptions): string {
	const rows = (node.content ?? []).filter((row) => row.type === 'tableRow');
	if (!rows.length) return '';
	const cells = rows.map((row) =>
		(row.content ?? []).map((cell) => inlineToMarkdown(flattenInline(cell.content ?? []), options).replace(/\n/g, ' ').replace(/\|/g, '\\|').trim())
	);
	const width = Math.max(1, ...cells.map((row) => row.length));
	const line = (row: string[]) => `| ${Array.from({ length: width }, (_v, i) => row[i] ?? '').join(' | ')} |`;
	const [header, ...body] = cells;
	return [line(header ?? []), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)].join('\n');
}

/** The inline nodes of blocks, the blocks separated by a space (a cell, or nesting past the limit). */
function flattenInline(nodes: ReadonlyArray<TiptapNode>): TiptapNode[] {
	const out: TiptapNode[] = [];
	for (const node of nodes) {
		if (isInlineNode(node)) out.push(node);
		else {
			if (out.length) out.push({ type: 'text', text: ' ' });
			out.push(...flattenInline(node.content ?? []));
		}
	}
	return out;
}

function flattenText(nodes: ReadonlyArray<TiptapNode>): string {
	return nodes.map((node) => (node.type === 'text' ? (node.text ?? '') : node.type === 'hardBreak' ? '\n' : flattenText(node.content ?? []))).join('');
}

const MARK_DELIMITERS: Readonly<Record<string, string>> = { bold: '**', italic: '*', strike: '~~' };

/** Inline nodes → Markdown: text with its bold / italic / strike / code / link marks, breaks and mentions. */
function inlineToMarkdown(nodes: ReadonlyArray<TiptapNode>, options: DocumentToMarkdownOptions): string {
	return nodes
		.map((node) => {
			switch (node.type) {
				case 'text':
					return markText(node);
				case 'hardBreak':
					return '\n';
				case 'emoji': {
					const name = String(node.attrs?.['name'] ?? '');
					return /^[\w+-]{1,64}$/.test(name) ? `:${name}:` : '';
				}
				case 'inlineMath': {
					const latex = String(node.attrs?.['latex'] ?? '').trim();
					return latex ? `$${latex}$` : '';
				}
				case 'employeeMention': {
					const label = String(node.attrs?.['label'] ?? '').trim();
					return label ? `@${escapeText(label)}` : '';
				}
				case 'image': {
					// An inline image (the editor may be configured so): as a block would be written.
					const src = String(node.attrs?.['src'] ?? '').trim();
					const alt = String(node.attrs?.['alt'] ?? '');
					return isSafeUrl(src, false) ? `![${escapeText(alt)}](${encodeParens(src)})` : escapeText(alt);
				}
				case 'documentMention': {
					const id = String(node.attrs?.['id'] ?? '');
					const path = id && options.resolveMention ? options.resolveMention(id) : null;
					if (path) return `[[${path}]]`;
					return escapeText(String(node.attrs?.['label'] ?? ''));
				}
				default:
					return inlineToMarkdown(node.content ?? [], options);
			}
		})
		.join('');
}

/** One text node with its marks as Markdown. */
function markText(node: TiptapNode): string {
	const raw = node.text ?? '';
	if (!raw) return '';
	const marks = node.marks ?? [];
	const link = marks.find((mark) => mark.type === 'link');
	const target = link?.attrs?.['href'];
	const href = typeof target === 'string' ? target.trim() : '';
	let text = marks.some((mark) => mark.type === 'code') ? codeSpan(raw.replace(/\n/g, ' ')) : escapeText(raw);
	for (const mark of marks) {
		const delimiter = MARK_DELIMITERS[mark.type];
		if (delimiter) text = wrap(delimiter, text);
	}
	if (link && isSafeUrl(href)) text = text.trim() === href ? `<${href}>` : `[${text.replace(/\n/g, ' ')}](${encodeParens(href)})`;
	return text;
}

/** Plain text escaped for Markdown; a literal `[[wikilink]]` (one Ever Works could not resolve) is kept as it is. */
function escapeText(text: string): string {
	let out = '';
	let last = 0;
	for (const match of text.matchAll(WIKILINK)) {
		out += escapePlain(text.slice(last, match.index)) + match[0];
		last = (match.index ?? 0) + match[0].length;
	}
	return out + escapePlain(text.slice(last));
}

function escapePlain(text: string): string {
	return text
		.replace(/\\(?=[\\`*_{}[\]()#+\-.!~|<>])/g, '\\\\')
		.replace(/[`*[]/g, (char) => `\\${char}`)
		.replace(/~(?=~)/g, '\\~')
		.replace(/(?<![\p{L}\p{N}_])_|_(?![\p{L}\p{N}_])/gu, '\\_')
		.replace(/<(?=[a-zA-Z/!])/g, '\\<');
}

/** Wraps inline Markdown in a delimiter, keeping surrounding spaces outside it (`** bold**` is not bold). */
function wrap(delimiter: string, inner: string): string {
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

const encodeParens = (url: string) => url.replace(/[()]/g, (char) => encodeURIComponent(char));

/** A paragraph's lines, trimmed, with a leading block marker escaped (so text never turns into a heading or a list). */
function paragraphText(markdown: string): string {
	return markdown
		.split('\n')
		.map((line) => escapeLineStart(line.trim()))
		.join('\n')
		.trim();
}

function escapeLineStart(line: string): string {
	if (/^#{1,6}( |$)/.test(line) || line.startsWith('>') || /^[-+]( |$)/.test(line) || /^ {0,3}([-*_])(?: *\1){2,} *$/.test(line)) return `\\${line}`;
	const ordered = /^(\d{1,9})([.)])( |$)/.exec(line);
	return ordered ? `${ordered[1]}\\${line.slice((ordered[1] ?? '').length)}` : line;
}

function quote(markdown: string): string {
	return markdown
		.split('\n')
		.map((line) => (line ? `> ${line}` : '>'))
		.join('\n');
}

// ── TipTap → HTML (render cache) ────────────────────────────────────────────────────────────────

/** A Docs PAGE → its HTML render cache (escaped text; links and images only to `http(s)` targets). */
export function documentToHtml(contentJson: unknown): string {
	const doc = parseContentJson(contentJson);
	return doc ? (doc.content ?? []).map((node) => nodeToHtml(node, 0)).join('') : '';
}

function nodeToHtml(node: TiptapNode, depth: number): string {
	if (depth > 100) return '';
	const children = () => (node.content ?? []).map((child) => nodeToHtml(child, depth + 1)).join('');
	switch (node.type) {
		case 'text':
			return markHtml(node);
		case 'hardBreak':
			return '<br>';
		case 'paragraph':
			return `<p>${children()}</p>`;
		case 'heading': {
			const level = Math.min(Math.max(Number(node.attrs?.['level']) || 1, 1), 6);
			return `<h${level}>${children()}</h${level}>`;
		}
		case 'blockquote':
			return `<blockquote>${children()}</blockquote>`;
		case 'bulletList':
			return `<ul>${children()}</ul>`;
		case 'orderedList': {
			const start = Number(node.attrs?.['start']) || 1;
			return `<ol${start !== 1 ? ` start="${start}"` : ''}>${children()}</ol>`;
		}
		case 'listItem':
			return `<li>${children()}</li>`;
		case 'taskList':
			return `<ul data-type="taskList">${children()}</ul>`;
		case 'taskItem':
			return `<li data-type="taskItem" data-checked="${node.attrs?.['checked'] ? 'true' : 'false'}">${children()}</li>`;
		case 'codeBlock':
			return `<pre><code>${escapeHtml(flattenText(node.content ?? []))}</code></pre>`;
		case 'horizontalRule':
			return '<hr>';
		case 'table':
			return `<table><tbody>${children()}</tbody></table>`;
		case 'tableRow':
			return `<tr>${children()}</tr>`;
		case 'tableHeader':
			return `<th>${children()}</th>`;
		case 'tableCell':
			return `<td>${children()}</td>`;
		case 'image': {
			const src = String(node.attrs?.['src'] ?? '').trim();
			return isSafeUrl(src, false) ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(String(node.attrs?.['alt'] ?? ''))}">` : '';
		}
		case 'documentMention':
		case 'employeeMention': {
			const char = node.type === 'documentMention' ? DOCUMENT_MENTION_CHAR : '@';
			return `<span data-type="${node.type}" data-id="${escapeHtml(String(node.attrs?.['id'] ?? ''))}">${escapeHtml(char + String(node.attrs?.['label'] ?? ''))}</span>`;
		}
		default:
			return children();
	}
}

function markHtml(node: TiptapNode): string {
	let html = escapeHtml(node.text ?? '');
	for (const mark of node.marks ?? []) {
		switch (mark.type) {
			case 'bold':
				html = `<strong>${html}</strong>`;
				break;
			case 'italic':
				html = `<em>${html}</em>`;
				break;
			case 'strike':
				html = `<s>${html}</s>`;
				break;
			case 'code':
				html = `<code>${html}</code>`;
				break;
			case 'link': {
				const target = mark.attrs?.['href'];
				const href = typeof target === 'string' ? target.trim() : '';
				if (isSafeUrl(href)) html = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${html}</a>`;
				break;
			}
			default:
				break;
		}
	}
	return html;
}
