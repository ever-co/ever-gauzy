import {
	blockToMarkdown,
	collectEmployeeMentionIds,
	collectFileIds,
	commentAnchorBlockIdOf,
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

	it('reads an image on a line of its own as an image block (in a list item, after the paragraph the item opens with), and leaves one among text in its paragraph', () => {
		const image = (src: string): IDocNode => ({ type: 'image', attrs: { src, alt: 'pic', title: null } });
		const markdown = '![pic](a.png)\n\n> ![pic](b.png)\n\nSee ![pic](c.png) here.\n\n- ![pic](d.png)\n- item\n\n  ![pic](e.png)\n';
		const parsed = markdownToDocument(markdown);
		expect(parsed.content).toEqual([
			image('a.png'),
			{ type: 'blockquote', content: [image('b.png')] },
			paragraph(text('See '), image('c.png'), text(' here.')),
			{
				type: 'bulletList',
				content: [
					{ type: 'listItem', content: [{ type: 'paragraph' }, image('d.png')] },
					{ type: 'listItem', content: [paragraph(text('item')), image('e.png')] }
				]
			}
		]);
		// The empty paragraph a list item opens with writes nothing: the Markdown reads back the same.
		expect(documentToMarkdown(parsed)).toBe(markdown);
		// No blank line of indentation between the blocks of a list item.
		const nested = documentToMarkdown({ type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('a')), paragraph(text('b'))] }] }] });
		expect(nested).toBe('- a\n\n  b\n');
	});

	it('reads marks, links, escapes and an empty text', () => {
		const parsed = markdownToDocument('A **bold** [link](https://x.test "T") and \\*stars\\*  \nnext');
		expect(parsed.content?.[0]).toEqual(
			paragraph(text('A '), text('bold', [{ type: 'bold' }]), text(' '), text('link', [{ type: 'link', attrs: { href: 'https://x.test', target: '_blank', rel: 'noopener noreferrer nofollow', title: 'T' } }]), text(' and *stars*'), { type: 'hardBreak' }, text('next'))
		);
		expect(markdownToDocument('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
	});

	it('decodes entity references once — named and numeric, in text and in link and image attributes — and leaves a code span literal', () => {
		const parsed = markdownToDocument('a &amp; b &amp;lt; &#39;q&#39; &#x41; `&lt;` ![t &amp; u](x.png "Tom &amp; Jerry") [l](https://x.test/?a=1&amp;b=2 "&#34;q&#34;")');
		expect(parsed.content?.[0]).toEqual(
			paragraph(
				text("a & b &lt; 'q' A "),
				text('&lt;', [{ type: 'code' }]),
				text(' '),
				{ type: 'image', attrs: { src: 'x.png', alt: 't & u', title: 'Tom & Jerry' } },
				text(' '),
				text('l', [{ type: 'link', attrs: { href: 'https://x.test/?a=1&b=2', target: '_blank', rel: 'noopener noreferrer nofollow', title: '"q"' } }])
			)
		);
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

	it('matches changed blocks and repeated ones in order', () => {
		const stored: IDocNode = { type: 'doc', content: [paragraph(text('a')), paragraph(text('b')), paragraph(text('c'))] };
		const merge = mergeMarkdownUpdate(stored, 'a\n\nx\n\nc\n');
		expect(merge.changedBlocks).toBe(1);
		expect(merge.keptBlocks).toBe(2);
		expect(merge.contentJson.content?.[0]).toBe(stored.content?.[0]);
		expect(merge.contentJson.content?.[2]).toBe(stored.content?.[2]);
		// A key that never matches is new, and repeated keys between the same unique blocks pair in order.
		const repeated: IDocNode = { type: 'doc', content: [paragraph(text('a')), paragraph(text('a')), paragraph(text('b'))] };
		const second = mergeMarkdownUpdate(repeated, 'zzz\n\na\n\na\n\nb\n');
		expect(second.changedBlocks).toBe(1);
		expect(second.keptBlocks).toBe(3);
		expect(second.contentJson.content?.[1]).toBe(repeated.content?.[0]);
		expect(second.contentJson.content?.[2]).toBe(repeated.content?.[1]);
		expect(second.contentJson.content?.[3]).toBe(repeated.content?.[2]);
	});

	it('keeps the attributes the Markdown cannot carry on an unchanged block', () => {
		const stored: IDocNode = { type: 'doc', content: [{ type: 'heading', attrs: { level: 1, textAlign: 'center', id: 'h-1' }, content: [text('Title')] }, paragraph(text('body'))] };
		const merge = mergeMarkdownUpdate(stored, '# Title\n\nbody changed\n');
		expect(merge.contentJson.content?.[0]).toMatchObject({ attrs: { textAlign: 'center', id: 'h-1' } });
		expect(blockToMarkdown(merge.contentJson.content?.[1] as IDocNode)).toBe('body changed');
	});
});

describe('mergeMarkdownUpdate: moved and identical blocks', () => {
	/** A paragraph carrying the editor's block id (a comment anchor) and an attribute Markdown cannot carry. */
	const block = (value: string, blockId: string): IDocNode => ({ type: 'paragraph', attrs: { blockId, textAlign: 'center' }, content: [text(value)] });
	const doc = (...content: IDocNode[]): IDocNode => ({ type: 'doc', content });

	it('keeps a moved block (its attributes and block id) wherever the text moved it', () => {
		const stored = doc(block('alpha', 'a'), block('beta', 'b'), block('gamma', 'c'));
		const merge = mergeMarkdownUpdate(stored, 'gamma\n\nalpha\n\nbeta\n');
		expect(merge.contentJson.content).toEqual([stored.content?.[2], stored.content?.[0], stored.content?.[1]]);
		expect(merge.contentJson.content?.[0]).toBe(stored.content?.[2]);
		expect(merge).toMatchObject({ changed: true, changedBlocks: 0, keptBlocks: 3, ambiguousBlockIds: [] });
		// A swap keeps both.
		const swapped = mergeMarkdownUpdate(doc(block('alpha', 'a'), block('beta', 'b')), 'beta\n\nalpha\n');
		expect(swapped.contentJson.content?.map((node) => node.attrs?.['blockId'])).toEqual(['b', 'a']);
		expect(swapped.changedBlocks).toBe(0);
	});

	it('tells identical blocks apart by the unique blocks around them, also when others moved', () => {
		const stored = doc(block('same', 'x1'), block('alpha', 'a'), block('same', 'x2'), block('beta', 'b'), block('gamma', 'c'));
		// `gamma` moved to the top; each `same` stays on its side of `alpha`.
		const merge = mergeMarkdownUpdate(stored, 'gamma\n\nsame\n\nalpha\n\nsame\n\nbeta\n');
		expect(merge.contentJson.content?.map((node) => node.attrs?.['blockId'])).toEqual(['c', 'x1', 'a', 'x2', 'b']);
		expect(merge).toMatchObject({ changedBlocks: 0, keptBlocks: 5, ambiguousBlockIds: [] });
		// Removing the twin after `alpha` keeps the one before it: no guess.
		const removed = mergeMarkdownUpdate(stored, 'same\n\nalpha\n\nbeta\n\ngamma\n');
		expect(removed.contentJson.content?.map((node) => node.attrs?.['blockId'])).toEqual(['x1', 'a', 'b', 'c']);
		expect(removed.ambiguousBlockIds).toEqual([]);
		// A copy added after `beta` is new; the stored twins keep their places.
		const copied = mergeMarkdownUpdate(stored, 'same\n\nalpha\n\nsame\n\nbeta\n\nsame\n\ngamma\n');
		expect(copied.contentJson.content?.map((node) => node.attrs?.['blockId'] ?? null)).toEqual(['x1', 'a', 'x2', 'b', null, 'c']);
		expect(copied).toMatchObject({ changedBlocks: 1, ambiguousBlockIds: [] });
	});

	it('names the blocks (and the blocks inside them) whose place among identical twins is a guess', () => {
		const list = (blockId: string, itemId: string): IDocNode => ({ type: 'bulletList', attrs: { blockId }, content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { blockId: itemId }, content: [text('todo')] }] }] });
		const stored = doc(list('l1', 'i1'), list('l2', 'i2'), block('alpha', 'a'));
		// One of two identical lists removed: which one is a guess (the merge keeps the first).
		const merge = mergeMarkdownUpdate(stored, '- todo\n\nalpha\n');
		expect(merge.ambiguousBlockIds).toEqual(['l1', 'i1', 'l2', 'i2']);
		expect(merge.contentJson.content?.[0]).toBe(stored.content?.[0]);
		expect(merge.contentJson.content).toHaveLength(2);
		// A twin that moved past a unique block (or was removed while another was added there) is a guess too.
		const twins = doc(block('same', 'x1'), block('alpha', 'a'), block('same', 'x2'), block('beta', 'b'));
		expect(mergeMarkdownUpdate(twins, 'alpha\n\nsame\n\nbeta\n\nsame\n').ambiguousBlockIds).toEqual(['x1']);
		// Every twin removed is no guess.
		expect(mergeMarkdownUpdate(twins, 'alpha\n\nbeta\n').ambiguousBlockIds).toEqual([]);
	});

	it('keeps a reordered page of thousands of blocks in linear-logarithmic time', () => {
		const count = 3000;
		const stored = doc(...Array.from({ length: count }, (_, index) => block(`paragraph ${index}`, `p${index}`)));
		const reversed = Array.from({ length: count }, (_, index) => `paragraph ${count - 1 - index}`).join('\n\n');
		const merge = mergeMarkdownUpdate(stored, `${reversed}\n`);
		expect(merge).toMatchObject({ changedBlocks: 0, keptBlocks: count, ambiguousBlockIds: [] });
		expect(merge.contentJson.content?.[0]).toBe(stored.content?.[count - 1]);
		expect(merge.contentJson.content?.[count - 1]).toBe(stored.content?.[0]);
	});

	it('places the empty paragraphs once each when an alternating reorder spans them again and again', () => {
		// 0, n-1, 1, n-2, …: every step back to the front spans most of the stored page.
		const count = 2000;
		const empty = (index: number): IDocNode => ({ type: 'paragraph', attrs: { blockId: `e${index}` } });
		const stored = doc(...Array.from({ length: count }, (_, index) => [block(`paragraph ${index}`, `p${index}`), empty(index)]).flat());
		const order = Array.from({ length: count }, (_, at) => (at % 2 === 0 ? at / 2 : count - 1 - (at - 1) / 2));
		const merge = mergeMarkdownUpdate(stored, `${order.map((index) => `paragraph ${index}`).join('\n\n')}\n`);
		const ids = merge.contentJson.content?.map((node) => String(node.attrs?.['blockId'])) ?? [];
		expect(merge).toMatchObject({ changedBlocks: 0, keptBlocks: count, ambiguousBlockIds: [] });
		expect(ids.filter((id) => id.startsWith('p'))).toEqual(order.map((index) => `p${index}`));
		const placed = ids.filter((id) => id.startsWith('e'));
		expect(new Set(placed).size).toBe(placed.length);
		// The empty paragraphs between the first kept pair (0, then n-1) all come along with it.
		expect(ids.slice(0, 3)).toEqual(['p0', 'e0', 'e1']);
	});

	it('keeps an empty paragraph once when two moved pairs of kept blocks span it', () => {
		const empty: IDocNode = { type: 'paragraph', attrs: { blockId: 'e' } };
		const stored = doc(block('alpha', 'a'), block('beta', 'b'), empty, block('gamma', 'c'), block('delta', 'd'));
		const merge = mergeMarkdownUpdate(stored, 'alpha\n\ngamma\n\nbeta\n\ndelta\n');
		expect(merge.contentJson.content?.filter((node) => node === empty)).toHaveLength(1);
		expect(merge.contentJson.content?.map((node) => node.attrs?.['blockId'])).toEqual(['a', 'e', 'c', 'b', 'd']);
	});
});

describe('commentAnchorBlockIdOf', () => {
	it('reads the block a comment is anchored to from its first line', () => {
		expect(commentAnchorBlockIdOf('[[block:3f1c2a7e-0000-4000-8000-000000000001]]\nLooks good')).toBe('3f1c2a7e-0000-4000-8000-000000000001');
		expect(commentAnchorBlockIdOf('A page-level comment')).toBeNull();
		expect(commentAnchorBlockIdOf('see [[block:abc]] later')).toBeNull();
		expect(commentAnchorBlockIdOf(null)).toBeNull();
	});
});

describe('link and image titles (CodeQL js/incomplete-sanitization)', () => {
	it('escapes backslashes before quotes, so a title ending in a backslash still closes', () => {
		const doc: IDocNode = {
			type: 'doc',
			content: [
				paragraph(
					text('l', [{ type: 'link', attrs: { href: 'https://x.test', title: 'a\\' } }]),
					{ type: 'image', attrs: { src: 'https://cdn.test/p.png', alt: 'p', title: 'say "hi" \\' } }
				)
			]
		};
		const markdown = documentToMarkdown(doc);
		expect(markdown).toContain('[l](https://x.test "a\\\\")');
		expect(markdown).toContain('![p](https://cdn.test/p.png "say \\"hi\\" \\\\")');
	});
});

describe('table cells (CodeQL js/incomplete-sanitization on the cell `|` escape)', () => {
	// A cell's Markdown has its backslashes escaped already (escapeText writes each as `\\`), and GFM takes the `\` off a
	// `\|` before it reads the cell's inline Markdown. So the cell escapes its pipes only: escaping its backslashes again
	// would double them, and the text would read back with two backslashes for each one it had.
	it('escapes only the pipes, so a text with backslashes and pipes reads back the same', () => {
		const value = 'C:\\dir | a\\|b \\';
		const doc: IDocNode = {
			type: 'doc',
			content: [
				{
					type: 'table',
					content: [
						{ type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph(text('Path'))] }] },
						{ type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph(text(value))] }] }
					]
				}
			]
		};
		const markdown = documentToMarkdown(doc);
		expect(markdown).toContain('| C:\\\\dir \\| a\\\\\\|b \\\\ |');
		expect(markdownToDocument(markdown).content?.[0]?.content?.[1]?.content?.[0]).toEqual({ type: 'tableCell', content: [paragraph(text(value))] });
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
