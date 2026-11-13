import { IDocumentSearchMatchRange, IDocumentSearchSnippet } from '@gauzy/contracts';

/** A run of a snippet's text: a match of the search term, or the text between. */
export interface IDocsSnippetSegment {
	text: string;
	match: boolean;
}

/**
 * The runs of a text with its matches marked, for a template to render as text (never as HTML: the server sends plain
 * text and `[start, end)` offsets, so a page's text can never inject markup into a result list). Matches are clamped
 * to the text, sorted, and an overlapping one is cut where the previous ends.
 */
export function snippetSegmentsOf(text: string | null | undefined, matches: readonly IDocumentSearchMatchRange[] | null | undefined): IDocsSnippetSegment[] {
	const value = String(text ?? '');
	if (!value) return [];
	const ranges = [...(matches ?? [])]
		.map((range) => ({ start: Math.max(0, Math.trunc(Number(range?.start))), end: Math.min(value.length, Math.trunc(Number(range?.end))) }))
		.filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
		.sort((left, right) => left.start - right.start);
	const segments: IDocsSnippetSegment[] = [];
	let at = 0;
	for (const range of ranges) {
		const start = Math.max(range.start, at);
		if (range.end <= start) continue;
		if (start > at) segments.push({ text: value.slice(at, start), match: false });
		segments.push({ text: value.slice(start, range.end), match: true });
		at = range.end;
	}
	if (at < value.length) segments.push({ text: value.slice(at), match: false });
	return segments;
}

/**
 * The snippet a search result shows under its name: the text around the first match, an ellipsis where the server cut
 * it. None when the result carries no snippet, or one with no text (a document with nothing but its name).
 */
export function searchSnippetLineOf(snippet: IDocumentSearchSnippet | null | undefined): IDocsSnippetSegment[] | null {
	if (!snippet?.text?.trim()) return null;
	const segments = snippetSegmentsOf(snippet.text, snippet.matches);
	if (snippet.truncatedStart) segments.unshift({ text: '… ', match: false });
	if (snippet.truncatedEnd) segments.push({ text: ' …', match: false });
	return segments;
}
