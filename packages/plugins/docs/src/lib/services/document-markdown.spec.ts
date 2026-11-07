import {
	blockToMarkdown,
	collectEmployeeMentionIds,
	collectFileIds,
	documentToMarkdown,
	IDocNode,
	markdownFileNameOf,
	markdownToDocument,
	mergeMarkdownUpdate,
	rawFileIdOf
} from './document-markdown';

const text = (value: string, marks?: IDocNode['marks']): IDocNode => ({ type: 'text', text: value, ...(marks ? { marks } : {}) });
const paragraph = (...content: IDocNode[]): IDocNode => ({ type: 'paragraph', content });

/** A page with every block of the stored subset. */
const PAGE: IDocNode = {
	type: 'doc',
	content: [
		{ type: 'heading', attrs: { level: 2 }, content: [text('Release '), text('notes', [{ type: 'bold' }])] },
		paragraph(text('Plain, '), text('bold', [{ type: 'bold' }]), text(', '), text('italic', [{ type: 'italic' }]), text(', '), text('gone', [{ type: 'strike' }]), text(' and '), text('code()', [{ type: 'code' }]), text(' with a '), text('link', [{ type: 'link', attrs: { href: 'https://example.test/a' } }]), text('.')),
		{ type: 'bulletList', content: [
			{ type: 'listItem', content: [paragraph(text('one'))] },
			{ type: 'listItem', content: [paragraph(text('two')), { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('two.one'))] }] }] }
		] },
		{ type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [paragraph(text('three'))] }, { type: 'listItem', content: [paragraph(text('four'))] }] },
		{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [paragraph(text('done'))] }, { type: 'taskItem', attrs: { checked: false }, content: [paragraph(text('open'))] }] },
		{ type: 'codeBlock', attrs: { language: 'ts' }, content: [text('const a = 1;\nconst b = 2;')] },
		{ type: 'blockquote', content: [paragraph(text('quoted')), paragraph(text('twice'))] },
		{ type: 'horizontalRule' },
		{ type: 'table', content: [
			{ type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('Name'))] }, { type: 'tableHeader', content: [paragraph(text('Size'))] }] },
			{ type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph(text('a | b'))] }, { type: 'tableCell', content: [paragraph(text('1'))] }] }
		] },
		{ type: 'image', attrs: { src: 'https://cdn.test/pic.png', alt: 'A picture', title: 'Pic' } },
		paragraph(text('line one'), { type: 'hardBreak' }, text('line two'))
	]
};

const PAGE_MARKDOWN = [
	'## Release **notes**',
	'',
	'Plain, **bold**, _italic_, ~~gone~~ and `code()` with a [link](https://example.test/a).',
	'',
	'- one',
	'- two',
	'',
	'  - two.one',
	'',
	'3. three',
	'4. four',
	'',
	'- [x] done',
	'- [ ] open',
	'',
	'```ts',
	'const a = 1;',
	'const b = 2;',
	'```',
	'',
	'> quoted',
	'> ',
	'> twice',
	'',
	'---',
	'',
	'| Name | Size |',
	'| --- | --- |',
	'| a \\| b | 1 |',
	'',
	'![A picture](https://cdn.test/pic.png "Pic")',
	'',
	'line one  ',
	'line two',
	''
].join('\n');

describe('documentToMarkdown', () => {
	it('writes every block of the stored subset', () => {
		expect(documentToMarkdown(PAGE)).toBe(PAGE_MARKDOWN);
	});

	it('escapes what would read as Markdown, keeps code as it is, and names mentions, emoji, maths and files', () => {
		const doc: IDocNode = {
			type: 'doc',
			content: [
				paragraph(text('2 * 3 _is_ [not] #six'), text(' x*y ', [{ type: 'code' }])),
				paragraph({ type: 'employeeMention', attrs: { id: 'e1', label: 'Ada' } }, text(' see '), { type: 'documentMention', attrs: { id: 'd1', label: 'Plan' } }, text(' '), { type: 'emoji', attrs: { name: 'tada' } }, text(' '), { type: 'inlineMath', attrs: { latex: 'x^2' } }),
				{ type: 'fileAttachment', attrs: { documentId: 'f1', name: 'spec.pdf' } },
				{ type: 'blockMath', attrs: { latex: 'E = mc^2' } },
				paragraph()
			]
		};
		expect(documentToMarkdown(doc, { linkOfDocument: (id) => `./${id}.md`, linkOfFile: (id) => `assets/${id}` })).toBe(
			['2 \\* 3 \\_is\\_ \\[not\\] #six` x*y `', '', '@Ada see [Plan](./d1.md) :tada: $x^2$', '', '[spec.pdf](assets/f1)', '', '$$', 'E = mc^2', '$$', ''].join('\n')
		);
		expect(documentToMarkdown({ type: 'doc', content: [paragraph(text('# not a heading'))] })).toBe('\\# not a heading\n');
		expect(documentToMarkdown(JSON.stringify(PAGE))).toBe(PAGE_MARKDOWN);
		expect(documentToMarkdown(null)).toBe('');
	});

	it('sizes a code fence to the backticks inside, and pads inline code that starts or ends with one', () => {
		const doc: IDocNode = {
			type: 'doc',
			content: [
				paragraph(text('a ``b`` c', [{ type: 'code' }]), text(' and '), text('`tick', [{ type: 'code' }])),
				{ type: 'codeBlock', attrs: { language: 'md' }, content: [text('```js\nx\n```')] }
			]
		};
		const markdown = documentToMarkdown(doc);
		expect(markdown).toBe('```a ``b`` c``` and `` `tick ``\n\n````md\n```js\nx\n```\n````\n');
		expect(documentToMarkdown(markdownToDocument(markdown))).toBe(markdown);
	});

	it('collects the employees a page mentions and the files it shows', () => {
		const doc: IDocNode = {
			type: 'doc',
			content: [
				paragraph({ type: 'employeeMention', attrs: { id: 'e1', label: 'Ada' } }, { type: 'documentMention', attrs: { id: 'd1' } }, { type: 'employeeMention', attrs: { id: 'e1' } }),
				{ type: 'image', attrs: { src: '/api/plugins/docs/documents/0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a/raw' } },
				{ type: 'image', attrs: { src: 'https://cdn.test/x.png' } },
				{ type: 'fileAttachment', attrs: { documentId: 'f2', name: 'a.pdf' } }
			]
		};
		expect(collectEmployeeMentionIds(doc)).toEqual(['e1']);
		expect(collectFileIds(doc)).toEqual(['0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a', 'f2']);
	});
});

describe('markdownToDocument', () => {
	it('reads the subset back so that its Markdown is the same again (a round trip)', () => {
		const parsed = markdownToDocument(PAGE_MARKDOWN);
		expect(documentToMarkdown(parsed)).toBe(PAGE_MARKDOWN);
		expect(parsed.content?.map((node) => node.type)).toEqual(['heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'codeBlock', 'blockquote', 'horizontalRule', 'table', 'image', 'paragraph']);
		expect(parsed.content?.[3]).toMatchObject({ type: 'orderedList', attrs: { start: 3 } });
		expect(parsed.content?.[4]).toMatchObject({ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true } }, { type: 'taskItem', attrs: { checked: false } }] });
		expect(parsed.content?.[5]).toMatchObject({ type: 'codeBlock', attrs: { language: 'ts' }, content: [{ type: 'text', text: 'const a = 1;\nconst b = 2;' }] });
	});

	it('reads marks, links, escapes and an empty text', () => {
		const parsed = markdownToDocument('A **bold** [link](https://x.test "T") and \\*stars\\*  \nnext');
		expect(parsed.content?.[0]).toEqual(
			paragraph(text('A '), text('bold', [{ type: 'bold' }]), text(' '), text('link', [{ type: 'link', attrs: { href: 'https://x.test', target: '_blank', rel: 'noopener noreferrer nofollow', title: 'T' } }]), text(' and *stars*'), { type: 'hardBreak' }, text('next'))
		);
		expect(markdownToDocument('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
	});
});

describe('mergeMarkdownUpdate', () => {
	it('keeps the stored block (by identity) when its Markdown did not change, and takes the new one when it did', () => {
		const stored = PAGE.content as IDocNode[];
		const edited = PAGE_MARKDOWN.replace('Plain, **bold**', 'Plainer, **bold**');
		const merge = mergeMarkdownUpdate(PAGE, edited);
		expect(merge.changed).toBe(true);
		expect(merge.changedBlocks).toBe(1);
		expect(merge.keptBlocks).toBe(stored.length - 1);
		expect(merge.contentJson.content?.[0]).toBe(stored[0]);
		expect(merge.contentJson.content?.[1]).not.toBe(stored[1]);
		expect(merge.contentJson.content?.[2]).toBe(stored[2]);
		expect(documentToMarkdown(merge.contentJson)).toBe(edited);
	});

	it('inserts, removes and reports no change for the same Markdown', () => {
		const same = mergeMarkdownUpdate(PAGE, PAGE_MARKDOWN);
		expect(same.changed).toBe(false);
		expect(same.changedBlocks).toBe(0);
		const inserted = mergeMarkdownUpdate(PAGE, PAGE_MARKDOWN.replace('---\n', '---\n\nA new paragraph.\n'));
		expect(inserted.changedBlocks).toBe(1);
		expect(inserted.contentJson.content).toHaveLength((PAGE.content as IDocNode[]).length + 1);
		const removed = mergeMarkdownUpdate(PAGE, PAGE_MARKDOWN.replace('---\n\n', ''));
		expect(removed.changed).toBe(true);
		expect(removed.changedBlocks).toBe(0);
		expect(removed.contentJson.content).toHaveLength((PAGE.content as IDocNode[]).length - 1);
	});

	it('keeps a block that reads back as several (details) and the empty paragraphs between kept blocks, when their text is unchanged', () => {
		const details: IDocNode = { type: 'details', attrs: { open: true }, content: [{ type: 'detailsSummary', content: [text('More')] }, { type: 'detailsContent', content: [paragraph(text('hidden'))] }] };
		const stored: IDocNode = { type: 'doc', content: [paragraph(text('first')), details, paragraph(), paragraph(text('last'))] };
		const exported = documentToMarkdown(stored);
		const same = mergeMarkdownUpdate(stored, exported);
		expect(same.changed).toBe(false);
		expect(same.contentJson).toBe(stored);
		const edited = mergeMarkdownUpdate(stored, exported.replace('first', 'first!'));
		expect(edited.changedBlocks).toBe(1);
		expect(edited.contentJson.content?.[1]).toBe(details);
		expect(edited.contentJson.content?.[2]).toBe(stored.content?.[2]);
		expect(edited.contentJson.content?.[3]).toBe(stored.content?.[3]);
		expect(edited.contentJson.content).toHaveLength(4);
	});

	it('matches in order without the table when the blocks would not fit it', () => {
		const stored: IDocNode = { type: 'doc', content: [paragraph(text('a')), paragraph(text('b')), paragraph(text('c'))] };
		const merge = mergeMarkdownUpdate(stored, 'a\n\nx\n\nc\n', { maxCells: 1 });
		expect(merge.changedBlocks).toBe(1);
		expect(merge.keptBlocks).toBe(2);
		expect(merge.contentJson.content?.[0]).toBe(stored.content?.[0]);
		expect(merge.contentJson.content?.[2]).toBe(stored.content?.[2]);
	});

	it('keeps the attributes the Markdown cannot carry on an unchanged block', () => {
		const stored: IDocNode = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1, textAlign: 'center', id: 'h-1' }, content: [text('Title')] }, paragraph(text('body'))] };
		const merge = mergeMarkdownUpdate(stored, '# Title\n\nbody changed\n');
		expect(merge.contentJson.content?.[0]).toMatchObject({ attrs: { textAlign: 'center', id: 'h-1' } });
		expect(blockToMarkdown(merge.contentJson.content?.[1] as IDocNode)).toBe('body changed');
	});
});

describe('names', () => {
	it('slugs a page name and reads the id of a raw-file URL', () => {
		expect(markdownFileNameOf('Q4 Plan — Résumé!')).toBe('q4-plan-resume.md');
		expect(markdownFileNameOf('   ')).toBe('document.md');
		expect(rawFileIdOf('/api/plugins/docs/documents/0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a/raw?x=1')).toBe('0b5a3f4e-6c1d-4f7a-9a52-3c2d1e0f9b8a');
		expect(rawFileIdOf('https://cdn.test/pic.png')).toBeNull();
	});
});
