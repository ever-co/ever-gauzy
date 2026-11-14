import { Lexer, Tokens, TokensList } from 'marked';

/** A node of the canonical TipTap JSON, as this module reads and writes it. */
export interface IDocNode {
	type: string;
	attrs?: Record<string, unknown>;
	content?: IDocNode[];
	text?: string;
	marks?: IDocMark[];
}

export interface IDocMark {
	type: string;
	attrs?: Record<string, unknown>;
}

/** How a serialisation names what it cannot carry inline: where a page link and a file go. */
export interface IMarkdownOptions {
	/** The link of a page the text mentions (`documentMention`); the platform's page URL by default. */
	linkOfDocument?: (documentId: string) => string;
	/** The link of a file (`fileAttachment`, an image served by the Documents API); the API's raw URL by default. */
	linkOfFile?: (documentId: string, url: string) => string;
}

/** The outcome of a Markdown update: the merged document, and how many blocks the Markdown changed or kept. */
export interface IMarkdownMerge {
	contentJson: IDocNode;
	/** Blocks of the merged document taken from the Markdown (new or changed). */
	changedBlocks: number;
	/** Blocks of the merged document kept as they were stored (their Markdown did not change). */
	keptBlocks: number;
	/** Whether the merged document differs from the stored one at all. */
	changed: boolean;
	/**
	 * The `blockId`s (of the block and the nodes inside it) of every stored block whose place the Markdown cannot tell:
	 * a block with an identical twin when the twins were added, removed or moved so that which one is which is a
	 * guess. The merge still makes its best guess; a caller that must not move or drop a comment anchored to one of
	 * these ids refuses the update instead (`DocumentMarkdownService`, 409 `DOCS_MARKDOWN_AMBIGUOUS`).
	 */
	ambiguousBlockIds: string[];
}

const DEFAULT_PAGE_LINK = (documentId: string) => `/pages/documents?id=${encodeURIComponent(documentId)}`;
const DEFAULT_FILE_LINK = (_documentId: string, url: string) => url;
/** The Documents API's raw-file URL: `/api/plugins/docs/documents/<id>/raw`. */
const RAW_FILE_URL = /\/api\/plugins\/docs\/documents\/([0-9a-f-]{36})\/raw(?:[?#].*)?$/i;

export function rawFileIdOf(url: unknown): string | null {
	const match = typeof url === 'string' ? RAW_FILE_URL.exec(url) : null;
	return match ? match[1] : null;
}

function attrsOf(node: IDocNode): Record<string, unknown> {
	return node.attrs && typeof node.attrs === 'object' ? node.attrs : {};
}

function childrenOf(node: IDocNode | null | undefined): IDocNode[] {
	return Array.isArray(node?.content) ? (node!.content as IDocNode[]) : [];
}

/** The canonical document as an object (the column may hold its JSON as text on SQLite). */
export function docOf(value: unknown): IDocNode {
	let parsed: unknown = value;
	if (typeof value === 'string' && value.trim()) {
		try {
			parsed = JSON.parse(value);
		} catch {
			parsed = null;
		}
	}
	if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as IDocNode).type === 'doc') {
		return parsed as IDocNode;
	}
	return { type: 'doc', content: [] };
}

// ---------------------------------------------------------------- JSON -> Markdown

/** Characters that would read as Markdown, escaped in plain text; line-leading block markers too. */
function escapeText(text: string): string {
	return text
		.replace(/[\\`*_[\]~<>]/g, (char) => `\\${char}`)
		.replace(/^(\s*)([#>+-]|\d+[.)])(\s)/gm, (_all, lead: string, marker: string, after: string) => `${lead}\\${marker}${after}`);
}

/** The longest run of backticks in a text (0 for none). */
function longestBacktickRun(text: string): number {
	let longest = 0;
	for (const run of text.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
	return longest;
}

function markOf(marks: IDocMark[] | undefined, type: string): IDocMark | undefined {
	return marks?.find((mark) => mark.type === type);
}

/** A text node as Markdown: a code span as it is, other text escaped, then its bold, italic, strike and link marks. */
function textToMarkdown(node: IDocNode): string {
	const raw = String(node.text ?? '');
	if (!raw) return '';
	const marks = Array.isArray(node.marks) ? node.marks : [];
	if (markOf(marks, 'code')) {
		// A fence longer than any run of backticks inside, padded when the text starts or ends with one (CommonMark).
		const fence = '`'.repeat(longestBacktickRun(raw) + 1);
		const pad = raw.startsWith('`') || raw.endsWith('`') ? ' ' : '';
		return `${fence}${pad}${raw}${pad}${fence}`;
	}
	let text = escapeText(raw);
	if (markOf(marks, 'bold')) text = `**${text}**`;
	if (markOf(marks, 'italic')) text = `_${text}_`;
	if (markOf(marks, 'strike')) text = `~~${text}~~`;
	const link = markOf(marks, 'link');
	if (link) {
		const href = String(attrsOf(link as IDocNode)['href'] ?? '');
		const title = attrsOf(link as IDocNode)['title'];
		text = `[${text}](${href}${title ? ` "${quotedTitle(title)}"` : ''})`;
	}
	return text;
}

function inlineToMarkdown(node: IDocNode, options: IMarkdownOptions): string {
	return childrenOf(node)
		.map((child) => {
			const attrs = attrsOf(child);
			switch (child.type) {
				case 'text':
					return textToMarkdown(child);
				case 'hardBreak':
					return '  \n';
				case 'employeeMention':
					return `@${String(attrs['label'] ?? attrs['id'] ?? '')}`;
				case 'documentMention': {
					const id = String(attrs['id'] ?? '');
					return `[${escapeText(String(attrs['label'] ?? id))}](${(options.linkOfDocument ?? DEFAULT_PAGE_LINK)(id)})`;
				}
				case 'emoji':
					return `:${String(attrs['name'] ?? '')}:`;
				case 'inlineMath':
					return `$${String(attrs['latex'] ?? '')}$`;
				case 'image':
					return imageToMarkdown(child, options);
				default:
					return inlineToMarkdown(child, options);
			}
		})
		.join('');
}

/** An image as Markdown (`![alt](url "title")`); a file of the Documents API (raw-file URL or `documentId`) gets `linkOfFile`'s link. */
function imageToMarkdown(node: IDocNode, options: IMarkdownOptions): string {
	const attrs = attrsOf(node);
	const src = String(attrs['src'] ?? '');
	const fileId = rawFileIdOf(src) ?? (typeof attrs['documentId'] === 'string' ? (attrs['documentId'] as string) : null);
	const url = fileId ? (options.linkOfFile ?? DEFAULT_FILE_LINK)(fileId, src) : src;
	const title = attrs['title'];
	return `![${escapeText(String(attrs['alt'] ?? ''))}](${url}${title ? ` "${quotedTitle(title)}"` : ''})`;
}

/** A link or image title for `"…"`: its backslashes first, then its quotes (a title ending in `\` kept the quote open). */
function quotedTitle(title: unknown): string {
	return String(title).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Each line of `text` behind `prefix` (`first` on the first line). A blank line stays blank where the prefix is only
 * indentation (between the blocks of a list item): indentation alone would make it a line of spaces, trailing
 * whitespace in the export that reads the same as a blank line. A prefix with a marker of its own (`> `) is kept, as
 * the block needs it on every line.
 */
function indentLines(text: string, prefix: string, first = prefix): string {
	return text
		.split('\n')
		.map((line, index) => {
			const lead = index === 0 ? first : prefix;
			return line === '' && lead.trim() === '' ? '' : lead + line;
		})
		.join('\n');
}

function listToMarkdown(node: IDocNode, options: IMarkdownOptions): string {
	const ordered = node.type === 'orderedList';
	const start = Number(attrsOf(node)['start']) || 1;
	return childrenOf(node)
		.map((item, index) => {
			const checked = item.type === 'taskItem' ? attrsOf(item)['checked'] === true : null;
			const marker = ordered ? `${start + index}. ` : checked === null ? '- ' : checked ? '- [x] ' : '- [ ] ';
			const body = childrenOf(item)
				.map((child) => blockToMarkdown(child, options))
				.filter((part) => part !== null)
				.join('\n\n');
			return indentLines(body || '', ' '.repeat(marker.length), marker);
		})
		.join('\n');
}

function tableCellToMarkdown(cell: IDocNode, options: IMarkdownOptions): string {
	return childrenOf(cell)
		.map((child) => (child.type === 'paragraph' ? inlineToMarkdown(child, options) : blockToMarkdown(child, options) ?? ''))
		.join(' ')
		.replace(/\s*\n\s*/g, ' ')
		.replace(/\|/g, '\\|')
		.trim();
}

function tableToMarkdown(node: IDocNode, options: IMarkdownOptions): string | null {
	const rows = childrenOf(node).filter((row) => row.type === 'tableRow');
	if (!rows.length) return null;
	const lines = rows.map((row) => `| ${childrenOf(row).map((cell) => tableCellToMarkdown(cell, options) || ' ').join(' | ')} |`);
	const width = childrenOf(rows[0]).length || 1;
	lines.splice(1, 0, `| ${Array.from({ length: width }, () => '---').join(' | ')} |`);
	return lines.join('\n');
}

/** One block as Markdown, or null for a block that has no Markdown (an empty paragraph). */
export function blockToMarkdown(node: IDocNode, options: IMarkdownOptions = {}): string | null {
	const attrs = attrsOf(node);
	switch (node.type) {
		case 'paragraph': {
			const text = inlineToMarkdown(node, options);
			return text.trim() ? text : null;
		}
		case 'heading': {
			const level = Math.min(Math.max(Number(attrs['level']) || 1, 1), 6);
			return `${'#'.repeat(level)} ${inlineToMarkdown(node, options)}`;
		}
		case 'bulletList':
		case 'orderedList':
		case 'taskList':
			return listToMarkdown(node, options);
		case 'codeBlock': {
			const language = String(attrs['language'] ?? '');
			const text = childrenOf(node).map((child) => String(child.text ?? '')).join('');
			const fence = '`'.repeat(Math.max(3, longestBacktickRun(text) + 1));
			return `${fence}${language}\n${text}\n${fence}`;
		}
		case 'blockquote':
		case 'callout':
		case 'detailsContent':
			return indentLines(blocksToMarkdown(childrenOf(node), options), '> ');
		case 'details': {
			const summary = childrenOf(node).find((child) => child.type === 'detailsSummary');
			const rest = childrenOf(node).filter((child) => child.type !== 'detailsSummary');
			const title = summary ? `**${inlineToMarkdown(summary, options)}**` : '';
			return [title, blocksToMarkdown(rest, options)].filter(Boolean).join('\n\n') || null;
		}
		case 'horizontalRule':
			return '---';
		case 'table':
			return tableToMarkdown(node, options);
		case 'image':
			return imageToMarkdown(node, options);
		case 'blockMath':
			return `$$\n${String(attrs['latex'] ?? '')}\n$$`;
		case 'youtube':
			return `[${escapeText(String(attrs['src'] ?? ''))}](${String(attrs['src'] ?? '')})`;
		case 'embedCard':
			return `[${escapeText(String(attrs['title'] ?? attrs['url'] ?? ''))}](${String(attrs['url'] ?? '')})`;
		case 'fileAttachment': {
			const id = String(attrs['documentId'] ?? '');
			const url = id ? (options.linkOfFile ?? DEFAULT_FILE_LINK)(id, `/api/plugins/docs/documents/${id}/raw`) : '';
			return `[${escapeText(String(attrs['name'] ?? id))}](${url})`;
		}
		default: {
			const text = inlineToMarkdown(node, options);
			return text.trim() ? text : null;
		}
	}
}

function blocksToMarkdown(blocks: IDocNode[], options: IMarkdownOptions): string {
	return blocks
		.map((block) => blockToMarkdown(block, options))
		.filter((part): part is string => part !== null)
		.join('\n\n');
}

/** The Markdown of a document: its blocks, a blank line between them, a final newline. */
export function documentToMarkdown(contentJson: unknown, options: IMarkdownOptions = {}): string {
	const markdown = blocksToMarkdown(childrenOf(docOf(contentJson)), options);
	return markdown ? `${markdown}\n` : '';
}

// ---------------------------------------------------------------- Markdown -> JSON

const ENTITY = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos|nbsp));/g;
const NAMED_ENTITIES: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

/**
 * The text a token's entity references name, decoded once, in one pass: `&amp;lt;` is the literal `&lt;` and never `<`
 * (a second pass would read the `&lt;` the first produced), and a numeric reference is its code point. The parser
 * leaves references as written, so this is where the Markdown's own meaning of them is applied — to text, and to the
 * destination, title and alternative text of a link or an image; never to a code span, which is literal.
 */
function decodeEntities(text: string): string {
	return text.replace(ENTITY, (match: string, decimal: string | undefined, hex: string | undefined, name: string | undefined) => {
		if (name) return NAMED_ENTITIES[name] ?? match;
		const code = decimal ? Number.parseInt(decimal, 10) : Number.parseInt(hex as string, 16);
		return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
	});
}

function withMark(nodes: IDocNode[], mark: IDocMark): IDocNode[] {
	return nodes.map((node) => {
		if (node.type === 'text') {
			return { ...node, marks: [...(node.marks ?? []), mark] };
		}
		return node.content ? { ...node, content: withMark(node.content, mark) } : node;
	});
}

function textNode(text: string): IDocNode[] {
	return text ? [{ type: 'text', text }] : [];
}

function inlineNodes(tokens: Tokens.Generic[] | undefined): IDocNode[] {
	const nodes: IDocNode[] = [];
	for (const token of tokens ?? []) {
		switch (token.type) {
			case 'text':
			case 'escape':
				nodes.push(...textNode(decodeEntities(String((token as Tokens.Text).text ?? ''))));
				break;
			case 'html':
				nodes.push(...textNode(String((token as Tokens.HTML).raw ?? '')));
				break;
			case 'strong':
				nodes.push(...withMark(inlineNodes((token as Tokens.Strong).tokens), { type: 'bold' }));
				break;
			case 'em':
				nodes.push(...withMark(inlineNodes((token as Tokens.Em).tokens), { type: 'italic' }));
				break;
			case 'del':
				nodes.push(...withMark(inlineNodes((token as Tokens.Del).tokens), { type: 'strike' }));
				break;
			case 'codespan':
				// A code span is literal: the parser hands its text as written, references included.
				nodes.push({ type: 'text', text: String((token as Tokens.Codespan).text ?? ''), marks: [{ type: 'code' }] });
				break;
			case 'link': {
				const link = token as Tokens.Link;
				const attrs: Record<string, unknown> = { href: decodeEntities(String(link.href ?? '')), target: '_blank', rel: 'noopener noreferrer nofollow' };
				if (link.title) attrs['title'] = decodeEntities(link.title);
				nodes.push(...withMark(inlineNodes(link.tokens), { type: 'link', attrs }));
				break;
			}
			case 'image': {
				const image = token as Tokens.Image;
				nodes.push({ type: 'image', attrs: { src: decodeEntities(String(image.href ?? '')), alt: image.text ? decodeEntities(image.text) : null, title: image.title ? decodeEntities(image.title) : null } });
				break;
			}
			case 'br':
				nodes.push({ type: 'hardBreak' });
				break;
			case 'checkbox':
				break;
			default:
				if (Array.isArray((token as Tokens.Generic)['tokens'])) nodes.push(...inlineNodes((token as Tokens.Generic)['tokens'] as Tokens.Generic[]));
				else if (typeof token.raw === 'string') nodes.push(...textNode(token.raw));
		}
	}
	return mergeAdjacentText(nodes);
}

function sameMarks(a: IDocMark[] | undefined, b: IDocMark[] | undefined): boolean {
	return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function mergeAdjacentText(nodes: IDocNode[]): IDocNode[] {
	const merged: IDocNode[] = [];
	for (const node of nodes) {
		const last = merged[merged.length - 1];
		if (last && last.type === 'text' && node.type === 'text' && sameMarks(last.marks, node.marks)) {
			merged[merged.length - 1] = { ...last, text: `${last.text ?? ''}${node.text ?? ''}` };
		} else {
			merged.push(node);
		}
	}
	return merged;
}

function paragraph(tokens: Tokens.Generic[] | undefined): IDocNode {
	const content = inlineNodes(tokens);
	return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

/** The images a paragraph holds when it holds nothing else (whitespace aside), or null. */
function imagesAlone(block: IDocNode): IDocNode[] | null {
	const content = block.content ?? [];
	const images = content.filter((child) => child.type === 'image');
	const alone = content.every(
		(child) => child.type === 'image' || (child.type === 'text' && !String(child.text ?? '').trim())
	);
	return images.length && alone ? images : null;
}

function listNode(list: Tokens.List): IDocNode {
	const task = list.items.some((item) => item.task);
	const type = list.ordered ? 'orderedList' : task ? 'taskList' : 'bulletList';
	const items: IDocNode[] = list.items.map((item) => {
		const content = blockNodes(item.tokens as Tokens.Generic[]);
		// The editor's list item opens with a paragraph (`paragraph block*`): an item that opens with an image (or any
		// other block) gets an empty one first, which writes no Markdown of its own.
		if (content[0]?.type !== 'paragraph') content.unshift({ type: 'paragraph' });
		const node: IDocNode = { type: task ? 'taskItem' : 'listItem', content };
		if (task) node.attrs = { checked: item.checked === true };
		return node;
	});
	const node: IDocNode = { type, content: items };
	if (list.ordered && typeof list.start === 'number' && list.start !== 1) node.attrs = { start: list.start };
	return node;
}

function tableNode(table: Tokens.Table): IDocNode | null {
	const cell = (type: 'tableHeader' | 'tableCell', tokens: Tokens.Generic[] | undefined): IDocNode => ({ type, content: [paragraph(tokens)] });
	const rows: IDocNode[] = [];
	if (table.header?.length) rows.push({ type: 'tableRow', content: table.header.map((head) => cell('tableHeader', head.tokens)) });
	for (const row of table.rows ?? []) rows.push({ type: 'tableRow', content: row.map((column) => cell('tableCell', column.tokens)) });
	return rows.length ? { type: 'table', content: rows } : null;
}

/**
 * The blocks of a run of block tokens. A paragraph that holds nothing but images (a Markdown image on a line of its own,
 * as the export writes an image) is those images as blocks, as the editor stores them: its `image` is a block node, so
 * a paragraph cannot hold one.
 */
function blockNodes(tokens: Tokens.Generic[] | undefined): IDocNode[] {
	const nodes: IDocNode[] = [];
	for (const token of tokens ?? []) {
		switch (token.type) {
			case 'space':
			case 'def':
				break;
			case 'heading': {
				const heading = token as Tokens.Heading;
				nodes.push({ type: 'heading', attrs: { level: Math.min(Math.max(heading.depth, 1), 6) }, content: inlineNodes(heading.tokens) });
				break;
			}
			case 'paragraph':
			case 'text': {
				const block = paragraph((token as Tokens.Paragraph).tokens ?? [token]);
				nodes.push(...(imagesAlone(block) ?? [block]));
				break;
			}
			case 'list':
				nodes.push(listNode(token as Tokens.List));
				break;
			case 'code': {
				const code = token as Tokens.Code;
				const attrs: Record<string, unknown> = { language: code.lang ? String(code.lang).trim().split(/\s+/)[0] : null };
				nodes.push({ type: 'codeBlock', attrs, content: textNode(String(code.text ?? '')) });
				break;
			}
			case 'blockquote':
				nodes.push({ type: 'blockquote', content: blockNodes((token as Tokens.Blockquote).tokens) });
				break;
			case 'hr':
				nodes.push({ type: 'horizontalRule' });
				break;
			case 'table': {
				const table = tableNode(token as Tokens.Table);
				if (table) nodes.push(table);
				break;
			}
			case 'html':
				nodes.push({ type: 'paragraph', content: textNode(String((token as Tokens.HTML).raw ?? '').trim()) });
				break;
			default:
				nodes.push(paragraph(Array.isArray(token['tokens']) ? (token['tokens'] as Tokens.Generic[]) : [token]));
		}
	}
	return nodes;
}

/** The ids of the employees a document mentions (`employeeMention` nodes), in document order, each once. */
export function collectEmployeeMentionIds(value: unknown): string[] {
	const ids = new Set<string>();
	const walk = (node: unknown): void => {
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		if (!node || typeof node !== 'object') return;
		const record = node as IDocNode;
		if (record.type === 'employeeMention') {
			const id = attrsOf(record)['id'];
			if (typeof id === 'string' && id.trim()) ids.add(id.trim());
		}
		walk(record.content);
	};
	walk(value);
	return [...ids];
}

/** The ids of the files a document shows: images served by the Documents API and attachments. */
export function collectFileIds(value: unknown): string[] {
	const ids = new Set<string>();
	const walk = (node: unknown): void => {
		if (Array.isArray(node)) {
			node.forEach(walk);
			return;
		}
		if (!node || typeof node !== 'object') return;
		const record = node as IDocNode;
		const attrs = attrsOf(record);
		if (record.type === 'image') {
			const id = rawFileIdOf(attrs['src']) ?? (typeof attrs['documentId'] === 'string' ? (attrs['documentId'] as string) : null);
			if (id) ids.add(id);
		} else if (record.type === 'fileAttachment' && typeof attrs['documentId'] === 'string' && attrs['documentId']) {
			ids.add(attrs['documentId'] as string);
		}
		walk(record.content);
	};
	walk(value);
	return [...ids];
}

/** The canonical document of a Markdown text (the stored subset: paragraphs, headings, lists, code, quotes, rules, tables, images, links and marks). */
export function markdownToDocument(markdown: string): IDocNode {
	const tokens: TokensList = new Lexer({ gfm: true, breaks: false }).lex(String(markdown ?? '').replace(/\r\n?/g, '\n'));
	const content = blockNodes(tokens as unknown as Tokens.Generic[]);
	return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

// ---------------------------------------------------------------- the block diff

/** The key a block is compared by: its Markdown, trailing whitespace aside. */
function keyOf(markdown: string | null): string {
	return (markdown ?? '').replace(/\s+$/g, '');
}

/**
 * The blocks a stored block becomes once its Markdown is read back: one for most, several for a `details` block
 * (its summary, then its content) — the parser decides, so the units are the ones an incoming text produces.
 */
function unitsOf(node: IDocNode): string[] {
	const markdown = blockToMarkdown(node);
	if (markdown === null) return [];
	return childrenOf(markdownToDocument(markdown)).map((block) => keyOf(blockToMarkdown(block)));
}

/** The anchor docs-ui writes as the first line of a block comment (`[[block:<blockId>]]`, `document-comments.model.ts`). */
const COMMENT_BLOCK_ANCHOR = /^\[\[block:([A-Za-z0-9._:-]{1,128})\]\]/;

/** The `blockId` a comment body is anchored to, or null for a comment on the page as a whole. */
export function commentAnchorBlockIdOf(comment: unknown): string | null {
	const match = typeof comment === 'string' ? COMMENT_BLOCK_ANCHOR.exec(comment) : null;
	return match ? match[1] : null;
}

/** The `blockId`s of a node and of the nodes inside it: the editor's UniqueID anchors (comments, `?block=` links). */
export function blockIdsOf(node: IDocNode): string[] {
	const ids: string[] = [];
	const walk = (current: IDocNode): void => {
		const id = attrsOf(current)['blockId'];
		if (typeof id === 'string' && id) ids.push(id);
		childrenOf(current).forEach(walk);
	};
	walk(node);
	return ids;
}

/** How many times each key occurs. */
function countsOf(keys: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
	return counts;
}

/** The indexes, into `values`, of a longest strictly increasing subsequence of `values` (patience sorting). */
function longestIncreasingSubsequence(values: readonly number[]): number[] {
	const tails: number[] = [];
	const previous = new Array<number>(values.length).fill(-1);
	values.forEach((value, index) => {
		let low = 0;
		let high = tails.length;
		while (low < high) {
			const mid = (low + high) >>> 1;
			if (values[tails[mid]] < value) low = mid + 1;
			else high = mid;
		}
		if (low > 0) previous[index] = tails[low - 1];
		tails[low] = index;
	});
	const run: number[] = [];
	for (let index = tails.length ? tails[tails.length - 1] : -1; index >= 0; index = previous[index]) run.push(index);
	return run.reverse();
}

/** For each position of a sequence, how many of the (ascending) `anchors` come before it: the gap it lies in. */
function gapsOf(anchors: readonly number[], length: number): number[] {
	const gaps = new Array<number>(length);
	let next = 0;
	for (let position = 0; position < length; position += 1) {
		while (next < anchors.length && anchors[next] < position) next += 1;
		gaps[position] = next;
	}
	return gaps;
}

/** How the incoming blocks match the stored units. */
interface IUnitMatch {
	/** For each incoming block, the index of the stored unit it matches, else -1. */
	matched: number[];
	/** The stored units whose match (or removal) is a guess among identical twins. */
	guessed: Set<number>;
}

/**
 * Matches the incoming blocks to the stored units by their Markdown, wherever they moved, in O((n + m) log(n + m))
 * time and O(n + m) memory:
 *
 * 1. A text found exactly once on each side is the same block, wherever it went: a moved block is kept. The longest
 *    run of those that kept their order are the anchors; the stretches before, between and after them are the gaps.
 * 2. A text with an identical twin (more than one block with that text on a side, and some on each) is matched gap
 *    by gap: a gap holding as many incoming twins as stored ones pairs them in order. The twins of the other gaps
 *    are what was added, removed or moved: when only stored ones are left they were removed, when only incoming
 *    ones they are new, and when both are left which is which is a guess — they are paired in order and the stored
 *    ones are reported as `guessed`.
 */
function matchUnits(stored: readonly string[], incoming: readonly string[]): IUnitMatch {
	const matched = new Array<number>(incoming.length).fill(-1);
	const guessed = new Set<number>();
	const storedCounts = countsOf(stored);
	const incomingCounts = countsOf(incoming);
	// 1. The texts found once on each side; the ones that kept their order are the anchors.
	const indexOfUnique = new Map<string, number>();
	incoming.forEach((key, index) => {
		if (incomingCounts.get(key) === 1 && storedCounts.get(key) === 1) indexOfUnique.set(key, index);
	});
	const unique: Array<{ unit: number; index: number }> = [];
	stored.forEach((key, unit) => {
		const index = indexOfUnique.get(key);
		if (index === undefined) return;
		unique.push({ unit, index });
		matched[index] = unit;
	});
	const anchors = longestIncreasingSubsequence(unique.map((pair) => pair.index)).map((at) => unique[at]);
	const storedGaps = gapsOf(anchors.map((anchor) => anchor.unit), stored.length);
	const incomingGaps = gapsOf(anchors.map((anchor) => anchor.index), incoming.length);
	// 2. The texts with twins, found on both sides: their positions, gap by gap.
	const isTwin = (key: string): boolean => {
		const inStored = storedCounts.get(key) ?? 0;
		const inIncoming = incomingCounts.get(key) ?? 0;
		return inStored > 0 && inIncoming > 0 && (inStored > 1 || inIncoming > 1);
	};
	const twins = new Map<string, { stored: Map<number, number[]>; incoming: Map<number, number[]> }>();
	const place = (key: string, side: 'stored' | 'incoming', gap: number, position: number): void => {
		const entry = twins.get(key) ?? { stored: new Map<number, number[]>(), incoming: new Map<number, number[]>() };
		twins.set(key, entry);
		const positions = entry[side].get(gap);
		if (positions) positions.push(position);
		else entry[side].set(gap, [position]);
	};
	stored.forEach((key, unit) => {
		if (isTwin(key)) place(key, 'stored', storedGaps[unit], unit);
	});
	incoming.forEach((key, index) => {
		if (isTwin(key)) place(key, 'incoming', incomingGaps[index], index);
	});
	for (const twin of twins.values()) {
		const leftStored: number[] = [];
		const leftIncoming: number[] = [];
		const gaps = [...new Set([...twin.stored.keys(), ...twin.incoming.keys()])].sort((a, b) => a - b);
		for (const gap of gaps) {
			const units = twin.stored.get(gap) ?? [];
			const indexes = twin.incoming.get(gap) ?? [];
			if (units.length === indexes.length) {
				units.forEach((unit, at) => (matched[indexes[at]] = unit));
			} else {
				// One by one: a spread of a large group of twins would pass the engine's argument limit.
				for (const unit of units) leftStored.push(unit);
				for (const index of indexes) leftIncoming.push(index);
			}
		}
		// Only removed twins, or only new ones: nothing to guess.
		if (!leftStored.length || !leftIncoming.length) continue;
		leftStored.forEach((unit) => guessed.add(unit));
		for (let at = 0; at < Math.min(leftStored.length, leftIncoming.length); at += 1) matched[leftIncoming[at]] = leftStored[at];
	}
	return { matched, guessed };
}

/**
 * The stored document with a Markdown text applied: a block whose Markdown is unchanged keeps its stored JSON (its
 * attributes, marks, block ids and nodes the Markdown cannot carry) wherever the text moved it, a block whose
 * Markdown changed, or is new, is the Markdown's; blocks the Markdown dropped are gone. A stored block is compared
 * through the blocks its own Markdown reads back as (a `details` block is several), and is kept only when all of them
 * come back, next to each other; an empty paragraph between two kept blocks is kept with them. Identical blocks are
 * told apart by the unique blocks around them (`matchUnits`); when that leaves a guess, the stored blocks concerned
 * are named in `ambiguousBlockIds`. The same text as the stored one changes nothing.
 */
export function mergeMarkdownUpdate(current: unknown, markdown: string): IMarkdownMerge {
	const document = docOf(current);
	const stored = childrenOf(document);
	const normalized = String(markdown ?? '').replace(/\r\n?/g, '\n').replace(/\s+$/g, '');
	if (normalized === documentToMarkdown(document).replace(/\s+$/g, '')) {
		return { contentJson: document, changedBlocks: 0, keptBlocks: stored.length, changed: false, ambiguousBlockIds: [] };
	}
	const incoming = childrenOf(markdownToDocument(markdown));
	const incomingKeys = incoming.map((block) => keyOf(blockToMarkdown(block)));
	const units: Array<{ owner: number; key: string }> = [];
	const unitsByOwner = new Map<number, number[]>();
	stored.forEach((block, owner) => {
		for (const key of unitsOf(block)) {
			unitsByOwner.set(owner, [...(unitsByOwner.get(owner) ?? []), units.length]);
			units.push({ owner, key });
		}
	});
	const { matched, guessed } = matchUnits(units.map((unit) => unit.key), incomingKeys);
	const incomingOfUnit = new Map<number, number>();
	matched.forEach((unit, index) => {
		if (unit >= 0) incomingOfUnit.set(unit, index);
	});
	// A stored block is kept when every unit of it came back, next to each other.
	const ownerOfIncoming = new Map<number, number>();
	const kept = new Set<number>();
	for (const [owner, ownerUnits] of unitsByOwner) {
		const positions = ownerUnits.map((unit) => incomingOfUnit.get(unit) ?? -1);
		const consecutive = positions.every((position, index) => position >= 0 && (index === 0 || position === positions[index - 1] + 1));
		if (!consecutive) continue;
		kept.add(owner);
		positions.forEach((position) => ownerOfIncoming.set(position, owner));
	}
	const guessedOwners = [...new Set([...guessed].map((unit) => units[unit].owner))].sort((a, b) => a - b);
	const ambiguousBlockIds = guessedOwners.flatMap((owner) => blockIdsOf(stored[owner]));
	// The empty paragraphs of the stored document (no Markdown of their own), in order. Each is placed once at most: a
	// skip pointer per entry jumps over the ones already placed, so the overlapping stretches between kept blocks that
	// a reorder produces are not scanned again (each empty paragraph is visited once, whatever the order).
	const empties: number[] = [];
	stored.forEach((block, position) => {
		if (blockToMarkdown(block) === null) empties.push(position);
	});
	const skip = Array.from({ length: empties.length + 1 }, (_, at) => at);
	const unplacedFrom = (at: number): number => {
		let root = at;
		while (skip[root] !== root) root = skip[root];
		for (let next = at; next !== root; ) {
			const up = skip[next];
			skip[next] = root;
			next = up;
		}
		return root;
	};
	const firstEmptyAfter = (position: number): number => {
		let low = 0;
		let high = empties.length;
		while (low < high) {
			const mid = (low + high) >>> 1;
			if (empties[mid] <= position) low = mid + 1;
			else high = mid;
		}
		return low;
	};
	const content: IDocNode[] = [];
	let lastOwner = -1;
	let changedBlocks = 0;
	for (let index = 0; index < incoming.length; index += 1) {
		const owner = ownerOfIncoming.get(index);
		if (owner === undefined) {
			content.push(incoming[index]);
			changedBlocks += 1;
			continue;
		}
		if (lastOwner === owner) continue; // the same stored block, continued
		// The empty paragraphs the stored document had between this block and the kept one before it stay with them
		// (each once: after a move, two pairs of kept blocks can span the same stored stretch).
		if (lastOwner >= 0 && owner > lastOwner) {
			for (let at = unplacedFrom(firstEmptyAfter(lastOwner)); at < empties.length && empties[at] < owner; at = unplacedFrom(at + 1)) {
				content.push(stored[empties[at]]);
				skip[at] = at + 1;
			}
		}
		content.push(stored[owner]);
		lastOwner = owner;
	}
	const changed = changedBlocks > 0 || content.length !== stored.length || content.some((block, index) => block !== stored[index]);
	return { contentJson: { type: 'doc', content }, changedBlocks, keptBlocks: kept.size, changed, ambiguousBlockIds };
}

/** A file name for a page: its name as a slug, `.md`. */
export function markdownFileNameOf(name: unknown, fallback = 'document'): string {
	const slug = String(name ?? '')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return `${slug || fallback}.md`;
}
