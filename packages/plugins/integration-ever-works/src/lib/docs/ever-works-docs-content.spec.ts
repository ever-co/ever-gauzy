// cspell:ignore wikilink wikilinks unfiled
/**
 * Document bodies between Ever Works (Markdown with `[[path]]` wikilinks) and Gauzy Docs (TipTap JSON +
 * HTML render cache), plan 05 §2 (G-P3-4). Pure functions: no mocks.
 */
import {
	DOCUMENT_NODE_LIMIT,
	documentToHtml,
	documentToMarkdown,
	markdownHash,
	markdownToDocument,
	parseContentJson,
	TiptapNode
} from './ever-works-docs-content';

/** Every node of a document, depth first. */
function nodes(node: TiptapNode): TiptapNode[] {
	return [node, ...(node.content ?? []).flatMap(nodes)];
}

const SAMPLE = [
	'# Title',
	'',
	'Some **bold** and *it* and ~~gone~~ and `code` and [a link](https://example.com).',
	'',
	'- one',
	'- two',
	'  - nested',
	'',
	'3. third',
	'4. fourth',
	'',
	'- [ ] todo',
	'- [x] done',
	'',
	'> quoted',
	'',
	'---',
	'',
	'```ts',
	'const a = 1;',
	'```',
	'',
	'| A | B |',
	'| --- | --- |',
	'| 1 | 2 |',
	'',
	'line one',
	'line two',
	'',
	'![logo](https://example.com/logo.png)'
].join('\n');

describe('Ever Works Markdown → Gauzy Docs page', () => {
	it('builds the editor schema: headings, marks, lists, task lists, quotes, rules, code, tables, breaks, images', () => {
		const { contentJson } = markdownToDocument(SAMPLE);
		const blocks = contentJson.content ?? [];
		expect(contentJson.type).toBe('doc');
		expect(blocks.map((block) => block.type)).toEqual([
			'heading',
			'paragraph',
			'bulletList',
			'orderedList',
			'taskList',
			'blockquote',
			'horizontalRule',
			'codeBlock',
			'table',
			'paragraph',
			'image'
		]);
		expect(blocks[0]).toEqual({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] });
		const marked = (blocks[1].content ?? []).filter((node) => node.marks?.length).map((node) => [node.text, node.marks?.map((mark) => mark.type)]);
		expect(marked).toEqual([
			['bold', ['bold']],
			['it', ['italic']],
			['gone', ['strike']],
			['code', ['code']],
			['a link', ['link']]
		]);
		const link = (blocks[1].content ?? []).find((node) => node.text === 'a link');
		expect(link?.marks?.[0]?.attrs).toEqual({ href: 'https://example.com', target: '_blank', rel: 'noopener noreferrer nofollow' });
		// A nested list sits inside its item, after the item's paragraph.
		const second = blocks[2].content?.[1];
		expect(second?.content?.map((node) => node.type)).toEqual(['paragraph', 'bulletList']);
		expect(blocks[3].attrs).toEqual({ start: 3 });
		expect(blocks[4].content?.map((item) => [item.type, item.attrs?.['checked'], item.content?.[0]?.content?.[0]?.text])).toEqual([
			['taskItem', false, 'todo'],
			['taskItem', true, 'done']
		]);
		expect(blocks[7]).toEqual({ type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: 'const a = 1;' }] });
		expect(blocks[8].content?.map((row) => row.content?.map((cell) => cell.type))).toEqual([
			['tableHeader', 'tableHeader'],
			['tableCell', 'tableCell']
		]);
		expect(blocks[9].content?.map((node) => node.type)).toEqual(['text', 'hardBreak', 'text']);
		expect(blocks[10]).toEqual({ type: 'image', attrs: { src: 'https://example.com/logo.png', alt: 'logo', title: null } });
	});

	it('only produces node and mark types the Docs editor schema has', () => {
		const allowed = new Set(['doc', 'paragraph', 'text', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'horizontalRule', 'hardBreak', 'codeBlock', 'taskList', 'taskItem', 'table', 'tableRow', 'tableHeader', 'tableCell', 'image', 'documentMention']);
		const marks = new Set(['bold', 'italic', 'strike', 'code', 'link']);
		const all = nodes(markdownToDocument(SAMPLE, { resolveWikilink: () => ({ documentId: 'd', label: 'D' }) }).contentJson);
		expect(all.filter((node) => !allowed.has(node.type))).toEqual([]);
		expect(all.flatMap((node) => node.marks ?? []).filter((mark) => !marks.has(mark.type))).toEqual([]);
		// ProseMirror refuses empty text nodes, and a list item starts with a paragraph.
		expect(all.filter((node) => node.type === 'text' && !node.text)).toEqual([]);
		expect(all.filter((node) => (node.type === 'listItem' || node.type === 'taskItem') && node.content?.[0]?.type !== 'paragraph')).toEqual([]);
	});

	it('turns a wikilink of a synced document into a document mention and keeps any other as literal text', () => {
		const { contentJson } = markdownToDocument('See [[support/escalation.md]] and [[missing.md]].', {
			resolveWikilink: (path) => (path === 'support/escalation.md' ? { documentId: 'doc-2', label: 'Escalation' } : null)
		});
		expect(contentJson.content?.[0]?.content).toEqual([
			{ type: 'text', text: 'See ' },
			{ type: 'documentMention', attrs: { id: 'doc-2', label: 'Escalation', mentionSuggestionChar: '+' } },
			{ type: 'text', text: ' and [[missing.md]].' }
		]);
		// Without a resolver every wikilink stays text.
		expect(markdownToDocument('[[a.md]]').contentJson.content?.[0]?.content).toEqual([{ type: 'text', text: '[[a.md]]' }]);
	});

	it('never links or embeds an unsafe target, and escapes markup in the render cache', () => {
		const { contentJson, contentHtml } = markdownToDocument('[x](javascript:alert(1)) ![y](data:image/png;base64,AAA) <script>alert(1)</script>');
		const all = nodes(contentJson);
		expect(all.some((node) => node.marks?.some((mark) => mark.type === 'link'))).toBe(false);
		expect(all.some((node) => node.type === 'image')).toBe(false);
		expect(contentHtml).not.toContain('<script');
		expect(contentHtml).toContain('&lt;script&gt;');
	});

	it('writes a document past the node limit as one Markdown code block', () => {
		const markdown = Array.from({ length: Math.ceil(DOCUMENT_NODE_LIMIT / 2) }, (_v, i) => `- item ${i}`).join('\n');
		const { contentJson } = markdownToDocument(markdown);
		expect(contentJson.content).toHaveLength(1);
		expect(contentJson.content?.[0]).toMatchObject({ type: 'codeBlock', attrs: { language: 'markdown' } });
		expect(contentJson.content?.[0]?.content?.[0]?.text).toBe(markdown);
	});

	it('gives an empty body an empty page', () => {
		expect(markdownToDocument('  \n ')).toEqual({ contentJson: { type: 'doc', content: [{ type: 'paragraph' }] }, contentHtml: '<p></p>' });
		expect(documentToMarkdown({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('');
	});
});

describe('Gauzy Docs page → Ever Works Markdown', () => {
	it('converts back to the same Markdown once normalised (stable: a second pass changes nothing)', () => {
		const once = documentToMarkdown(markdownToDocument(SAMPLE).contentJson);
		expect(documentToMarkdown(markdownToDocument(once).contentJson)).toBe(once);
		// The language of a fence is not kept (the Markdown converter drops it); everything else reads the same.
		expect(once).toBe(SAMPLE.replace('```ts', '```'));
	});

	it('writes a mention of a synced document as its wikilink, else its label', () => {
		const doc: TiptapNode = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'See ' },
						{ type: 'documentMention', attrs: { id: 'g-2', label: 'Escalation' } },
						{ type: 'text', text: ' and ' },
						{ type: 'documentMention', attrs: { id: 'g-3', label: 'Other' } }
					]
				}
			]
		};
		expect(documentToMarkdown(doc, { resolveMention: (id) => (id === 'g-2' ? 'support/escalation.md' : null) })).toBe('See [[support/escalation.md]] and Other');
	});

	it('degrades what Markdown has no syntax for to its text, and keeps unknown nodes’ content', () => {
		const doc: TiptapNode = {
			type: 'doc',
			content: [
				{ type: 'callout', attrs: { type: 'info' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note' }] }] },
				{
					type: 'details',
					content: [
						{ type: 'detailsSummary', content: [{ type: 'text', text: 'More' }] },
						{ type: 'detailsContent', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hidden' }] }] }
					]
				},
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'u', marks: [{ type: 'underline' }] },
						{ type: 'emoji', attrs: { name: 'smile' } },
						{ type: 'employeeMention', attrs: { id: 'e-1', label: 'Ada' } }
					]
				},
				{ type: 'embedCard', attrs: { url: 'https://example.com', title: 'Site' } },
				{ type: 'fancyBlock', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'kept' }] }] }
			]
		};
		expect(documentToMarkdown(doc)).toBe('> Note\n\n**More**\n\nHidden\n\nu:smile:@Ada\n\n[Site](https://example.com)\n\nkept');
	});

	it('escapes text that would read as Markdown, but keeps a literal wikilink', () => {
		const doc: TiptapNode = {
			type: 'doc',
			content: [{ type: 'paragraph', content: [{ type: 'text', text: '# not a heading *nor bold* [[kept.md]]' }] }]
		};
		const markdown = documentToMarkdown(doc);
		expect(markdown).toBe('\\# not a heading \\*nor bold\\* [[kept.md]]');
		// …and it reads back as the same text.
		expect(markdownToDocument(markdown).contentJson.content?.[0]?.content).toEqual([{ type: 'text', text: '# not a heading *nor bold* [[kept.md]]' }]);
	});

	it('round-trips bold italic text and plain text with backticks unchanged (review #10829)', () => {
		const doc: TiptapNode = {
			type: 'doc',
			content: [
				{
					type: 'paragraph',
					content: [
						{ type: 'text', text: 'both', marks: [{ type: 'bold' }, { type: 'italic' }] },
						{ type: 'text', text: ' and use `x` here' }
					]
				}
			]
		};
		const markdown = documentToMarkdown(doc);
		expect(markdown).toBe(String.raw`**_both_** and use \`x\` here`);
		const back = markdownToDocument(markdown).contentJson.content?.[0]?.content ?? [];
		expect(back.map((node) => [node.text, (node.marks ?? []).map((mark) => mark.type).sort()])).toEqual([
			['both', ['bold', 'italic']],
			[' and use `x` here', []]
		]);
	});

	it('opens a code span after an escaped backslash (an even run of backslashes), not after an escaped backtick', () => {
		// Markdown: one \\`two` and \`three\`
		const nodes = markdownToDocument('one \\\\`two` and \\`three\\`').contentJson.content?.[0]?.content ?? [];
		expect(nodes.map((node) => [node.text, (node.marks ?? []).map((mark) => mark.type)])).toEqual([
			['one \\', []],
			['two', ['code']],
			[' and `three`', []]
		]);
	});

	it('keeps images of a table cell and of a heading (review #10829)', () => {
		const { contentJson } = markdownToDocument(['# Logo ![a](https://example.com/a.png)', '', '| Diagram |', '| --- |', '| ![b](https://example.com/b.png) |'].join('\n'));
		const blocks = contentJson.content ?? [];
		expect(blocks.map((block) => block.type)).toEqual(['heading', 'image', 'table']);
		expect(blocks[1].attrs?.['src']).toBe('https://example.com/a.png');
		const cell = blocks[2].content?.[1]?.content?.[0];
		expect(cell?.content).toEqual([{ type: 'image', attrs: { src: 'https://example.com/b.png', alt: 'b', title: null } }]);
	});

	it('accepts the SQLite text form of the column', () => {
		const doc = markdownToDocument('Hello **world**').contentJson;
		expect(documentToMarkdown(JSON.stringify(doc))).toBe(documentToMarkdown(doc));
		expect(parseContentJson('not json')).toBeNull();
		expect(documentToMarkdown(null)).toBe('');
	});

	it('renders the HTML cache from the page', () => {
		const html = documentToHtml(markdownToDocument('# T\n\n- [x] done\n\n**b** [l](https://example.com)').contentJson);
		expect(html).toBe(
			'<h1>T</h1><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>done</p></li></ul><p><strong>b</strong> <a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">l</a></p>'
		);
	});
});

describe('markdownHash', () => {
	it('fingerprints the normalised Markdown (line endings and trailing spaces do not count)', () => {
		expect(markdownHash('a\r\nb  \n')).toBe(markdownHash('a\nb'));
		expect(markdownHash('a')).not.toBe(markdownHash('b'));
		expect(markdownHash(null)).toBe(markdownHash(''));
	});
});
