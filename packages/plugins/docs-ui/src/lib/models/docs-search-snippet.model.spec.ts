import { DocumentSearchSnippetSourceEnum, IDocumentSearchSnippet } from '@gauzy/contracts';
import { searchSnippetLineOf, snippetSegmentsOf } from './docs-search-snippet.model';

const snippet = (overrides: Partial<IDocumentSearchSnippet> = {}): IDocumentSearchSnippet => ({
	source: DocumentSearchSnippetSourceEnum.CONTENT,
	text: 'the quarterly plan and the plan review',
	matches: [
		{ start: 14, end: 18 },
		{ start: 27, end: 31 }
	],
	nameMatches: [],
	truncatedStart: false,
	truncatedEnd: false,
	...overrides
});

describe('snippetSegmentsOf', () => {
	it('splits the text into runs with the matches marked', () => {
		expect(snippetSegmentsOf('the quarterly plan and the plan review', snippet().matches)).toEqual([
			{ text: 'the quarterly ', match: false },
			{ text: 'plan', match: true },
			{ text: ' and the ', match: false },
			{ text: 'plan', match: true },
			{ text: ' review', match: false }
		]);
	});

	it('sorts the matches, clamps them to the text, and cuts an overlapping one', () => {
		expect(
			snippetSegmentsOf('abcdef', [
				{ start: 4, end: 99 },
				{ start: -3, end: 2 },
				{ start: 1, end: 3 },
				{ start: 5, end: 5 }
			])
		).toEqual([
			{ text: 'ab', match: true },
			{ text: 'c', match: true },
			{ text: 'd', match: false },
			{ text: 'ef', match: true }
		]);
	});

	it('keeps markup in the text as text (the template renders it as text)', () => {
		expect(snippetSegmentsOf('<b>plan</b>', [{ start: 3, end: 7 }])).toEqual([
			{ text: '<b>', match: false },
			{ text: 'plan', match: true },
			{ text: '</b>', match: false }
		]);
	});
});

describe('searchSnippetLineOf', () => {
	it('adds an ellipsis where the server cut the text', () => {
		const segments = searchSnippetLineOf(snippet({ truncatedStart: true, truncatedEnd: true }));
		expect(segments?.[0]).toEqual({ text: '… ', match: false });
		expect(segments?.at(-1)).toEqual({ text: ' …', match: false });
	});

	it('shows nothing without a snippet or without text', () => {
		expect(searchSnippetLineOf(undefined)).toBeNull();
		expect(searchSnippetLineOf(snippet({ text: '  ', matches: [] }))).toBeNull();
	});
});
