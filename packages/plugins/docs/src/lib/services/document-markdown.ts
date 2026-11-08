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

function indentLines(text: string, prefix: string, first = prefix): string {
	return text
		.split('\n')
		.map((line, index) => (index === 0 ? first : prefix) + line)
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

function listNode(list: Tokens.List): IDocNode {
	const task = list.items.some((item) => item.task);
	const type = list.ordered ? 'orderedList' : task ? 'taskList' : 'bulletList';
	const items: IDocNode[] = list.items.map((item) => {
		const content = blockNodes(item.tokens as Tokens.Generic[]);
		const node: IDocNode = { type: task ? 'taskItem' : 'listItem', content: content.length ? content : [{ type: 'paragraph' }] };
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
			case 'text':
				nodes.push(paragraph((token as Tokens.Paragraph).tokens ?? [token]));
				break;
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

/** The most cells the exact (longest common subsequence) matcher allocates; past it the in-order matcher is used. */
export const MARKDOWN_DIFF_MAX_CELLS = 2_000_000;

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

/**
 * For each incoming key, the index of the stored unit it matches, else -1: a longest common subsequence while the
 * table fits (`maxCells`), otherwise an in-order match — each incoming key takes the first unmatched stored unit with
 * that key at or after the one last taken — through an index of the stored keys and a binary search over each key's
 * positions, so a key that never matches costs one lookup rather than a scan of the tail: O((n + m) log n) in time
 * and O(n + m) in memory, whatever the texts.
 */
function matchUnits(stored: string[], incoming: string[], maxCells: number): number[] {
	const n = stored.length;
	const m = incoming.length;
	const matched = new Array<number>(m).fill(-1);
	if (!n || !m) return matched;
	if (n * m > maxCells) {
		const positions = new Map<string, number[]>();
		stored.forEach((key, index) => {
			const list = positions.get(key);
			if (list) list.push(index);
			else positions.set(key, [index]);
		});
		let cursor = 0;
		for (let j = 0; j < m; j += 1) {
			const list = positions.get(incoming[j]);
			if (!list) continue;
			let low = 0;
			let high = list.length;
			while (low < high) {
				const mid = (low + high) >>> 1;
				if (list[mid] < cursor) low = mid + 1;
				else high = mid;
			}
			if (low < list.length) {
				matched[j] = list[low];
				cursor = list[low] + 1;
			}
		}
		return matched;
	}
	const rows: Int32Array[] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
	for (let i = n - 1; i >= 0; i -= 1) {
		for (let j = m - 1; j >= 0; j -= 1) {
			rows[i][j] = stored[i] === incoming[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
		}
	}
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (stored[i] === incoming[j]) {
			matched[j] = i;
			i += 1;
			j += 1;
		} else if (rows[i + 1][j] >= rows[i][j + 1]) {
			i += 1;
		} else {
			j += 1;
		}
	}
	return matched;
}

/**
 * The stored document with a Markdown text applied: a block whose Markdown is unchanged keeps its stored JSON (its
 * attributes, marks and nodes the Markdown cannot carry), a block whose Markdown changed, or is new, is the Markdown's;
 * blocks the Markdown dropped are gone. A stored block is compared through the blocks its own Markdown reads back as
 * (a `details` block is several), and is kept only when all of them come back, in order; an empty paragraph between
 * two kept blocks is kept with them. The same text as the stored one changes nothing.
 */
export function mergeMarkdownUpdate(current: unknown, markdown: string, options: { maxCells?: number } = {}): IMarkdownMerge {
	const document = docOf(current);
	const stored = childrenOf(document);
	const normalized = String(markdown ?? '').replace(/\r\n?/g, '\n').replace(/\s+$/g, '');
	if (normalized === documentToMarkdown(document).replace(/\s+$/g, '')) {
		return { contentJson: document, changedBlocks: 0, keptBlocks: stored.length, changed: false };
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
	const matched = matchUnits(units.map((unit) => unit.key), incomingKeys, options.maxCells ?? MARKDOWN_DIFF_MAX_CELLS);
	const incomingOfUnit = new Map<number, number>();
	matched.forEach((unit, index) => {
		if (unit >= 0) incomingOfUnit.set(unit, index);
	});
	// A stored block is kept when every unit of it came back, in order and next to each other.
	const ownerOfIncoming = new Map<number, number>();
	const kept = new Set<number>();
	for (const [owner, ownerUnits] of unitsByOwner) {
		const positions = ownerUnits.map((unit) => incomingOfUnit.get(unit) ?? -1);
		const consecutive = positions.every((position, index) => position >= 0 && (index === 0 || position === positions[index - 1] + 1));
		if (!consecutive) continue;
		kept.add(owner);
		positions.forEach((position) => ownerOfIncoming.set(position, owner));
	}
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
		// The empty paragraphs the stored document had between this block and the kept one before it stay with them.
		if (lastOwner >= 0 && owner > lastOwner) {
			for (let between = lastOwner + 1; between < owner; between += 1) {
				if (blockToMarkdown(stored[between]) === null) content.push(stored[between]);
			}
		}
		content.push(stored[owner]);
		lastOwner = owner;
	}
	const changed = changedBlocks > 0 || content.length !== stored.length || content.some((block, index) => block !== stored[index]);
	return { contentJson: { type: 'doc', content }, changedBlocks, keptBlocks: kept.size, changed };
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
