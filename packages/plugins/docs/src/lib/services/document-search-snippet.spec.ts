import { DocumentSearchSnippetSourceEnum } from '@gauzy/contracts';
import { DOCS_SEARCH_SNIPPET_LENGTH, matchRangesOf, plainTextOfHtml, plainTextOfJson, searchSnippetOf } from './document-search-snippet';

const page = (...paragraphs: string[]) => ({
	type: 'doc',
	content: paragraphs.map((text) => ({ type: 'paragraph', attrs: { blockId: text.slice(0, 4) }, content: [{ type: 'text', text }] }))
});

/** What each match of a snippet covers. */
const matched = (snippet: { text: string; matches: Array<{ start: number; end: number }> }) => snippet.matches.map((match) => snippet.text.slice(match.start, match.end));

describe('document search snippets', () => {
	describe('plain text', () => {
		it('reads a page as its blocks with a space between them, a mention as @Name', () => {
			const json = {
				type: 'doc',
				content: [
					{ type: 'heading', content: [{ type: 'text', text: 'Title' }] },
					{ type: 'paragraph', content: [{ type: 'text', text: 'Ask ' }, { type: 'mention', attrs: { id: 'e1', label: 'Ann' } }, { type: 'hardBreak' }, { type: 'text', text: 'today' }] }
				]
			};
			expect(plainTextOfJson(json)).toBe('Title Ask @Ann today');
			expect(plainTextOfJson(JSON.stringify(json))).toBe('Title Ask @Ann today');
			expect(plainTextOfJson('{broken')).toBe('');
		});

		it('reads HTML as text: tags out, blocks apart, entities decoded, scripts dropped', () => {
			expect(plainTextOfHtml('<h1>A&amp;B</h1><p>x &lt;y&gt; &#39;z&#39; &#x41;</p><script>alert(1)</script>')).toBe("A&B x <y> 'z' A");
			expect(plainTextOfHtml(null)).toBe('');
		});
	});

	describe('matchRangesOf', () => {
		it('finds every case-insensitive match, special characters taken literally', () => {
			expect(matchRangesOf('Plan, plan and PLAN.', 'plan')).toEqual([
				{ start: 0, end: 4 },
				{ start: 6, end: 10 },
				{ start: 15, end: 19 }
			]);
			expect(matchRangesOf('cost (net) is 3.5', '(net)')).toEqual([{ start: 5, end: 10 }]);
			expect(matchRangesOf('a.b', '.')).toEqual([{ start: 1, end: 2 }]);
			expect(matchRangesOf('anything', '   ')).toEqual([]);
		});
	});

	describe('searchSnippetOf', () => {
		const long = `${'Words fill the page before. '.repeat(10)}The roadmap for the next quarter is here. ${'More words follow it after. '.repeat(10)}`;

		it('cuts about 160 characters around the first match, at word boundaries, with its offsets', () => {
			const snippet = searchSnippetOf('roadmap', { name: 'Planning', contentJson: page(long) });
			expect(snippet.source).toBe(DocumentSearchSnippetSourceEnum.CONTENT);
			expect(snippet.text.length).toBeLessThanOrEqual(DOCS_SEARCH_SNIPPET_LENGTH);
			expect(snippet.text.length).toBeGreaterThan(DOCS_SEARCH_SNIPPET_LENGTH - 45);
			expect(matched(snippet)).toEqual(['roadmap']);
			expect(snippet.truncatedStart).toBe(true);
			expect(snippet.truncatedEnd).toBe(true);
			// Cut between words: a space before the snippet and after it in the page's text.
			const whole = plainTextOfJson(page(long));
			const at = whole.indexOf(snippet.text);
			expect(whole[at - 1]).toBe(' ');
			expect(whole[at + snippet.text.length]).toBe(' ');
			expect(snippet.nameMatches).toEqual([]);
		});

		it('gives every match inside the snippet and the matches of the name', () => {
			const snippet = searchSnippetOf('plan', { name: 'Plan B', contentJson: page('The plan is to plan the Plan.') });
			expect(snippet).toMatchObject({ text: 'The plan is to plan the Plan.', truncatedStart: false, truncatedEnd: false, nameMatches: [{ start: 0, end: 4 }] });
			expect(matched(snippet)).toEqual(['plan', 'plan', 'Plan']);
		});

		it('reads the HTML cache of a page without JSON, then a file extracted text, then the description', () => {
			expect(searchSnippetOf('budget', { contentHtml: '<p>The <strong>budget</strong> is set.</p>' })).toMatchObject({ source: DocumentSearchSnippetSourceEnum.CONTENT, text: 'The budget is set.' });
			expect(searchSnippetOf('invoice', { extractedText: 'Invoice 42\n\nTotal due' })).toMatchObject({
				source: DocumentSearchSnippetSourceEnum.EXTRACTED_TEXT,
				text: 'Invoice 42 Total due',
				matches: [{ start: 0, end: 7 }]
			});
			expect(searchSnippetOf('travel', { contentJson: page('Nothing here'), description: 'Travel policy' })).toMatchObject({ source: DocumentSearchSnippetSourceEnum.DESCRIPTION });
		});

		it('gives the beginning of the text, without matches, when only the name matched', () => {
			const snippet = searchSnippetOf('roadmap', { name: 'Roadmap 2027', contentJson: page(long.replace('roadmap', 'plan')) });
			expect(snippet.source).toBe(DocumentSearchSnippetSourceEnum.LEADING);
			expect(snippet.matches).toEqual([]);
			expect(snippet.text.startsWith('Lorem ipsum')).toBe(true);
			expect(snippet.truncatedStart).toBe(false);
			expect(snippet.truncatedEnd).toBe(true);
			expect(snippet.nameMatches).toEqual([{ start: 0, end: 7 }]);
			expect(searchSnippetOf('x', { name: 'x' })).toEqual({ source: DocumentSearchSnippetSourceEnum.LEADING, text: '', matches: [], nameMatches: [{ start: 0, end: 1 }], truncatedStart: false, truncatedEnd: false });
		});

		it('keeps a match near the end of a long text whole', () => {
			const text = `${'word '.repeat(80)}finale`;
			const snippet = searchSnippetOf('finale', { contentJson: page(text) });
			expect(matched(snippet)).toEqual(['finale']);
			expect(snippet.truncatedEnd).toBe(false);
			expect(snippet.text.endsWith('finale')).toBe(true);
		});
	});
});
