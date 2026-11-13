import { DocumentSearchSnippetSourceEnum, IDocumentSearchMatchRange, IDocumentSearchSnippet } from '@gauzy/contracts';

/**
 * Search snippets of Docs results (`GET /documents?q=…`, `docs-collaboration` plan §4 "Search snippets").
 *
 * Plain text only: the snippet is the document's text around the first match, whitespace collapsed and cut at word
 * boundaries, and the matches are `[start, end)` offsets into it — never HTML, so a client marks them up its own way
 * (and a page's text can never inject markup into a result list).
 */

/** About this many characters of text around the first match. */
export const DOCS_SEARCH_SNIPPET_LENGTH = 160;
/** A cut moves to a word boundary at most this far. */
const WORD_BOUNDARY_SLACK = 20;
/** Of the room the match leaves in the snippet, this share goes before it. */
const BEFORE_SHARE = 0.4;
/** The most results of one list that get a snippet (a list is a page of at most this many in the clients). */
export const DOCS_SEARCH_SNIPPET_MAX_ITEMS = 50;
/** The most text a snippet is looked for in (the start of a very long page or file). */
export const DOCS_SEARCH_SNIPPET_MAX_TEXT = 200_000;

/** A JSON node of a page. */
interface ISnippetJsonNode {
	type?: string;
	attrs?: Record<string, unknown> | null;
	content?: ISnippetJsonNode[] | null;
	text?: string | null;
}

/** The inline nodes that are text to a reader (a mention reads as `@Name`, a hard break as a space). */
function inlineTextOf(node: ISnippetJsonNode): string | null {
	if (node.type === 'hardBreak') return ' ';
	if (node.type === 'mention' || node.type === 'employeeMention' || node.type === 'documentMention') {
		const label = node.attrs?.['label'] ?? node.attrs?.['title'] ?? node.attrs?.['name'];
		return typeof label === 'string' && label ? `@${label}` : '';
	}
	return null;
}

/** The plain text of a page's TipTap JSON: the text of its blocks, a space between blocks. */
export function plainTextOfJson(contentJson: unknown): string {
	let root: ISnippetJsonNode | null = null;
	if (typeof contentJson === 'string') {
		try {
			root = JSON.parse(contentJson) as ISnippetJsonNode;
		} catch {
			return '';
		}
	} else if (contentJson && typeof contentJson === 'object') {
		root = contentJson as ISnippetJsonNode;
	}
	if (!root) return '';
	const parts: string[] = [];
	let length = 0;
	const visit = (node: ISnippetJsonNode | null | undefined): void => {
		if (!node || typeof node !== 'object' || length >= DOCS_SEARCH_SNIPPET_MAX_TEXT) return;
		if (node.type === 'text') {
			// Only what still fits: one long pasted paragraph is cut at the limit like the page.
			const text = (typeof node.text === 'string' ? node.text : '').slice(0, DOCS_SEARCH_SNIPPET_MAX_TEXT - length);
			parts.push(text);
			length += text.length;
			return;
		}
		const inline = inlineTextOf(node);
		if (inline !== null) {
			parts.push(inline);
			length += inline.length;
			return;
		}
		if (Array.isArray(node.content)) for (const child of node.content) visit(child);
		// A block ends with a space, so two blocks never read as one word.
		parts.push(' ');
		length += 1;
	};
	visit(root);
	return collapseWhitespace(parts.join(''));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** The plain text of an HTML fragment (a page's render cache): tags out, block ends as spaces, entities decoded. */
export function plainTextOfHtml(html: string | null | undefined): string {
	if (!html) return '';
	const text = String(html)
		.slice(0, DOCS_SEARCH_SNIPPET_MAX_TEXT * 2)
		.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote|pre|tr|td|th|table|br|hr)\b[^>]*>/gi, ' ')
		.replace(/<[^>]*>/g, '')
		.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+|#39);/gi, (entity: string, code: string) => {
			const lower = code.toLowerCase();
			if (ENTITIES[lower] !== undefined) return ENTITIES[lower];
			if (lower.startsWith('#x')) return safeCodePoint(parseInt(lower.slice(2), 16)) ?? entity;
			if (lower.startsWith('#')) return safeCodePoint(parseInt(lower.slice(1), 10)) ?? entity;
			return entity;
		});
	return collapseWhitespace(text);
}

function safeCodePoint(code: number): string | null {
	return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
}

/** Runs of whitespace as one space, and none at the ends. */
export function collapseWhitespace(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

/** A search term as the list route matches it, whitespace collapsed (`LIKE %q%`, case-insensitive). */
function termOf(q: string | null | undefined): string {
	return collapseWhitespace(String(q ?? ''));
}

/** The first case-insensitive match of `term` in `text`, or null. */
export function firstMatchOf(text: string, term: string): IDocumentSearchMatchRange | null {
	const needle = termOf(term);
	if (!needle || !text) return null;
	const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu');
	const match = pattern.exec(text);
	return match && match[0].length > 0 ? { start: match.index, end: match.index + match[0].length } : null;
}

/** Every case-insensitive match of `term` in `text`, as offsets into `text`. */
export function matchRangesOf(text: string, term: string): IDocumentSearchMatchRange[] {
	const needle = termOf(term);
	if (!needle || !text) return [];
	const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
	const ranges: IDocumentSearchMatchRange[] = [];
	for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
		if (match[0].length === 0) {
			pattern.lastIndex += 1;
			continue;
		}
		ranges.push({ start: match.index, end: match.index + match[0].length });
	}
	return ranges;
}

/** The texts of a document a snippet may come from, best first. */
export interface ISnippetSources {
	name?: string | null;
	contentJson?: unknown;
	contentHtml?: string | null;
	extractedText?: string | null;
	description?: string | null;
}

/**
 * The snippet of a document for a search term: the first of the page's text, a file's extracted text and the
 * description in which the term is found, cut to about {@link DOCS_SEARCH_SNIPPET_LENGTH} characters around the
 * first match, with every match in it. When none of them holds the term (the name matched), the beginning of the
 * first text there is, with no matches. The name's matches are given either way.
 */
export function searchSnippetOf(q: string | null | undefined, sources: ISnippetSources, length = DOCS_SEARCH_SNIPPET_LENGTH): IDocumentSearchSnippet {
	const term = termOf(q);
	const jsonText = plainTextOfJson(sources.contentJson);
	// The content search matches the HTML cache: when the JSON's text does not hold the term, the HTML's may.
	const htmlText = !jsonText || !firstMatchOf(jsonText, term) ? plainTextOfHtml(sources.contentHtml) : '';
	const candidates: Array<[DocumentSearchSnippetSourceEnum, string]> = [
		[DocumentSearchSnippetSourceEnum.CONTENT, jsonText],
		[DocumentSearchSnippetSourceEnum.CONTENT, htmlText],
		[DocumentSearchSnippetSourceEnum.EXTRACTED_TEXT, collapseWhitespace(String(sources.extractedText ?? '').slice(0, DOCS_SEARCH_SNIPPET_MAX_TEXT))],
		[DocumentSearchSnippetSourceEnum.DESCRIPTION, collapseWhitespace(String(sources.description ?? ''))]
	];
	const nameMatches = matchRangesOf(String(sources.name ?? ''), term);
	for (const [source, text] of candidates) {
		const first = firstMatchOf(text, term);
		if (first) {
			// The window around the first match, then the matches inside it: never every match of a long text.
			const cut = windowAround(text, [first], length);
			return { source, nameMatches, ...cut, matches: matchRangesOf(cut.text, term) };
		}
	}
	const leading = candidates.find(([, text]) => text.length > 0)?.[1] ?? '';
	const cut = windowAround(leading, [], length);
	return { source: DocumentSearchSnippetSourceEnum.LEADING, nameMatches, ...cut, matches: [] };
}

/** About `length` characters of `text` around the first of `matches` (the beginning without one), at word boundaries. */
function windowAround(
	text: string,
	matches: IDocumentSearchMatchRange[],
	length: number
): Pick<IDocumentSearchSnippet, 'text' | 'matches' | 'truncatedStart' | 'truncatedEnd'> {
	if (text.length <= length) {
		return { text, matches, truncatedStart: false, truncatedEnd: false };
	}
	const first = matches[0] ?? { start: 0, end: 0 };
	const room = Math.max(0, length - (first.end - first.start));
	let start = Math.max(0, first.start - Math.floor(room * BEFORE_SHARE));
	let end = Math.min(text.length, start + Math.max(length, first.end - first.start));
	if (end === text.length) start = Math.max(0, end - length);
	// To word boundaries, never cutting into the first match.
	if (start > 0) {
		const space = text.indexOf(' ', start);
		if (space >= 0 && space < first.start && space - start <= WORD_BOUNDARY_SLACK) start = space + 1;
	}
	if (end < text.length) {
		const space = text.lastIndexOf(' ', end);
		if (space > first.end && end - space <= WORD_BOUNDARY_SLACK) end = space;
	}
	const slice = text.slice(start, end);
	const lead = slice.length - slice.trimStart().length;
	const body = slice.trim();
	const offset = start + lead;
	return {
		text: body,
		matches: matches
			.filter((match) => match.start >= offset && match.end <= offset + body.length)
			.map((match) => ({ start: match.start - offset, end: match.end - offset })),
		truncatedStart: offset > 0,
		truncatedEnd: offset + body.length < text.length
	};
}
