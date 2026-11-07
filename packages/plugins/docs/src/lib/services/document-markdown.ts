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

function markOf(marks: IDocMark[] | undefined, type: string): IDocMark | undefined {
	return marks?.find((mark) => mark.type === type);
}

function textToMarkdown(node: IDocNode): string {
	const raw = String(node.text ?? '');
	if (!raw) return '';
	const marks = Array.isArray(node.marks) ? node.marks : [];
	if (markOf(marks, 'code')) {
		const fence = raw.includes('`') ? '``' : '`';
		return `${fence}${raw}${fence}`;
	}
	let text = escapeText(raw);
	if (markOf(marks, 'bold')) text = `**${text}**`;
	if (markOf(marks, 'italic')) text = `_${text}_`;
	if (markOf(marks, 'strike')) text = `~~${text}~~`;
	const link = markOf(marks, 'link');
	if (link) {
		const href = String(attrsOf(link as IDocNode)['href'] ?? '');
		const title = attrsOf(link as IDocNode)['title'];
		text = `[${text}](${href}${title ? ` "${String(title).replace(/"/g, '\\"')}"` : ''})`;
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

function imageToMarkdown(node: IDocNode, options: IMarkdownOptions): string {
	const attrs = attrsOf(node);
	const src = String(attrs['src'] ?? '');
	const fileId = rawFileIdOf(src) ?? (typeof attrs['documentId'] === 'string' ? (attrs['documentId'] as string) : null);
	const url = fileId ? (options.linkOfFile ?? DEFAULT_FILE_LINK)(fileId, src) : src;
	const title = attrs['title'];
	return `![${escapeText(String(attrs['alt'] ?? ''))}](${url}${title ? ` "${String(title).replace(/"/g, '\\"')}"` : ''})`;
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
			const fence = text.includes('```') ? '````' : '```';
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

function unescapeHtml(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
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
				nodes.push(...textNode(unescapeHtml(String((token as Tokens.Text).text ?? ''))));
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
				nodes.push({ type: 'text', text: unescapeHtml(String((token as Tokens.Codespan).text ?? '')), marks: [{ type: 'code' }] });
				break;
			case 'link': {
				const link = token as Tokens.Link;
				const attrs: Record<string, unknown> = { href: link.href, target: '_blank', rel: 'noopener noreferrer nofollow' };
				if (link.title) attrs['title'] = link.title;
				nodes.push(...withMark(inlineNodes(link.tokens), { type: 'link', attrs }));
				break;
			}
			case 'image': {
				const image = token as Tokens.Image;
				nodes.push({ type: 'image', attrs: { src: image.href, alt: image.text || null, title: image.title || null } });
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

/** The canonical document of a Markdown text (the stored subset: paragraphs, headings, lists, code, quotes, rules, tables, images, links and marks). */
export function markdownToDocument(markdown: string): IDocNode {
	const tokens: TokensList = new Lexer({ gfm: true, breaks: false }).lex(String(markdown ?? '').replace(/\r\n?/g, '\n'));
	const content = blockNodes(tokens as unknown as Tokens.Generic[]);
	return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

// ---------------------------------------------------------------- the block diff

/** The key a block is compared by: its Markdown, trailing whitespace aside. */
function blockKeyOf(node: IDocNode): string {
	return (blockToMarkdown(node) ?? '').replace(/\s+$/g, '');
}

/** For each incoming block, the index of the stored block it matches (a longest common subsequence of block keys), else -1. */
function matchBlocks(current: string[], incoming: string[]): number[] {
	const n = current.length;
	const m = incoming.length;
	const table: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i -= 1) {
		for (let j = m - 1; j >= 0; j -= 1) {
			table[i][j] = current[i] === incoming[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
		}
	}
	const matched = new Array<number>(m).fill(-1);
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (current[i] === incoming[j]) {
			matched[j] = i;
			i += 1;
			j += 1;
		} else if (table[i + 1][j] >= table[i][j + 1]) {
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
 * blocks the Markdown dropped are gone.
 */
export function mergeMarkdownUpdate(current: unknown, markdown: string): IMarkdownMerge {
	const stored = childrenOf(docOf(current));
	const incoming = childrenOf(markdownToDocument(markdown));
	const matched = matchBlocks(stored.map(blockKeyOf), incoming.map(blockKeyOf));
	const content = incoming.map((node, index) => (matched[index] >= 0 ? stored[matched[index]] : node));
	const keptBlocks = matched.filter((index) => index >= 0).length;
	const changedBlocks = incoming.length - keptBlocks;
	const changed = changedBlocks > 0 || keptBlocks !== stored.length || matched.some((index, position) => index >= 0 && stored[index] !== content[position]);
	return { contentJson: { type: 'doc', content }, changedBlocks, keptBlocks, changed };
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
