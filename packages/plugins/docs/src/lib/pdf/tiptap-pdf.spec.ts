import { collectImageIds, formatBytes, IPdfRenderContext, plainTextOf, tiptapToPdfContent } from './tiptap-pdf';

const FILE = '11111111-2222-4333-8444-555555555555';
const PAGE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const ctx: IPdfRenderContext = {
	contentWidth: 500,
	imageOf: (id) => (id === FILE ? { key: 'img0', width: 800, height: 400 } : null),
	anchorOf: (id) => (id === PAGE ? `page-${id}` : null)
};

const doc = (...content: unknown[]) => ({ type: 'doc', content });
const p = (...content: unknown[]) => ({ type: 'paragraph', content });
const t = (text: string, marks?: unknown[]) => ({ type: 'text', text, ...(marks ? { marks } : {}) });

describe('tiptapToPdfContent', () => {
	it('renders headings and paragraphs with their marks', () => {
		const out = tiptapToPdfContent(
			doc(
				{ type: 'heading', attrs: { level: 2 }, content: [t('Title')] },
				p(
					t('bold', [{ type: 'bold' }]),
					t('it', [{ type: 'italic' }]),
					t('u', [{ type: 'underline' }, { type: 'strike' }]),
					t('code', [{ type: 'code' }]),
					t('site', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
					t('js', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])
				)
			),
			ctx
		) as any[];
		expect(out[0]).toEqual({ style: 'h2', text: [{ text: 'Title' }] });
		const runs = out[1].text;
		expect(runs[0]).toEqual({ text: 'bold', bold: true });
		expect(runs[1]).toEqual({ text: 'it', italics: true });
		expect(runs[2].decoration).toEqual(['underline', 'lineThrough']);
		expect(runs[3]).toMatchObject({ style: 'code' });
		expect(runs[4]).toMatchObject({ link: 'https://example.com', decoration: 'underline' });
		expect(runs[5].link).toBeUndefined();
	});

	it('draws a loaded image as a block between the text around it, and an unloaded one as its text', () => {
		const out = tiptapToPdfContent(
			doc(p(t('before'), { type: 'image', attrs: { src: `/api/plugins/docs/documents/${FILE}/raw`, alt: 'chart' } }, t('after'), { type: 'image', attrs: { src: 'https://cdn.example.com/x.png', alt: 'remote' } })),
			ctx
		) as any[];
		expect(out.map((block) => block.image ?? block.text)).toEqual([[{ text: 'before' }], 'img0', [{ text: 'after' }], '[remote]']);
		expect(out[1].fit[0]).toBe(500);
	});

	it('renders lists, task lists with boxes, ordered starts', () => {
		const out = tiptapToPdfContent(
			doc(
				{ type: 'bulletList', content: [{ type: 'listItem', content: [p(t('one'))] }] },
				{ type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(t('three'))] }] },
				{ type: 'taskList', content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(t('done'))] }, { type: 'taskItem', attrs: { checked: false }, content: [p(t('open'))] }] }
			),
			ctx
		) as any[];
		expect(out[0].ul).toHaveLength(1);
		expect(out[1]).toMatchObject({ start: 3 });
		expect(out[2].type).toBe('none');
		expect(out[2].ul[0].stack[0].text[0]).toEqual({ text: '[x] ' });
		expect(out[2].ul[1].stack[0].text[0]).toEqual({ text: '[ ] ' });
	});

	it('renders tables with header rows and column spans', () => {
		const out = tiptapToPdfContent(
			doc({
				type: 'table',
				content: [
					{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p(t('A'))] }, { type: 'tableHeader', content: [p(t('B'))] }] },
					{ type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 2 }, content: [p(t('wide'))] }] }
				]
			}),
			ctx
		) as any[];
		expect(out[0].table.headerRows).toBe(1);
		expect(out[0].table.widths).toEqual(['*', '*']);
		expect(out[0].table.body[1]).toHaveLength(2);
		expect(out[0].table.body[1][0]).toMatchObject({ colSpan: 2 });
	});

	it('lays merged cells on the grid: a rowspan leaves a placeholder in the rows below', () => {
		const cell = (text: string, attrs: Record<string, unknown> = {}) => ({ type: 'tableCell', attrs, content: [p(t(text))] });
		const out = tiptapToPdfContent(
			doc({
				type: 'table',
				content: [
					{ type: 'tableRow', content: [cell('tall', { rowspan: 2 }), cell('b1')] },
					{ type: 'tableRow', content: [cell('b2')] },
					{ type: 'tableRow', content: [cell('c1'), cell('c2')] }
				]
			}),
			ctx
		) as any[];
		const body = out[0].table.body;
		expect(body[0][0]).toMatchObject({ rowSpan: 2 });
		expect(body[1][0]).toEqual({});
		expect(body[1][1].stack[0].text).toEqual([{ text: 'b2' }]);
		expect(body[2].map((item: any) => item.stack[0].text[0].text)).toEqual(['c1', 'c2']);
		expect(out[0].table.widths).toEqual(['*', '*']);
	});

	it('renders quotes, callouts and code as boxes, rules as lines, toggles, math, mentions and cards as text', () => {
		const out = tiptapToPdfContent(
			doc(
				{ type: 'blockquote', content: [p(t('quote'))] },
				{ type: 'callout', attrs: { type: 'warning' }, content: [p(t('careful'))] },
				{ type: 'codeBlock', attrs: { language: 'ts' }, content: [t('const a = 1;\n  b();')] },
				{ type: 'horizontalRule' },
				{ type: 'details', content: [{ type: 'detailsSummary', content: [t('More')] }, { type: 'detailsContent', content: [p(t('hidden'))] }] },
				{ type: 'blockMath', attrs: { latex: 'e=mc^2' } },
				p({ type: 'documentMention', attrs: { id: PAGE, label: 'Roadmap' } }, { type: 'employeeMention', attrs: { id: 'e', label: 'Ana' } }, { type: 'emoji', attrs: { name: 'rocket' } }),
				{ type: 'fileAttachment', attrs: { documentId: FILE, name: 'spec.pdf', size: 2048 } },
				{ type: 'embedCard', attrs: { url: 'https://example.com', title: 'Example' } }
			),
			ctx
		) as any[];
		expect(out[0].table.body[0][0].stack[0].text).toEqual([{ text: 'quote' }]);
		expect(out[1].layout.fillColor()).toBe('#fff7e6');
		expect(out[2].table.body[0][0].stack[0]).toMatchObject({ text: 'const a = 1;\n  b();', preserveLeadingSpaces: true });
		expect(out[3].canvas[0]).toMatchObject({ type: 'line', x2: 500 });
		expect(out[4]).toMatchObject({ bold: true, text: [{ text: 'More' }] });
		expect(out[5].stack[0].text).toEqual([{ text: 'hidden' }]);
		expect(out[6]).toMatchObject({ text: 'e=mc^2', italics: true });
		expect(out[7].text).toEqual([
			{ text: 'Roadmap', color: '#1a56db', linkToDestination: `page-${PAGE}` },
			{ text: '@Ana', color: '#1a56db' },
			{ text: ':rocket:' }
		]);
		expect(out[8].text[0]).toEqual({ text: 'spec.pdf', bold: true });
		expect(out[9]).toMatchObject({ text: 'Example', link: 'https://example.com' });
	});

	it('reads the JSON text SQLite stores, and an empty page as nothing', () => {
		expect(tiptapToPdfContent(JSON.stringify(doc(p(t('x')))), ctx)).toEqual([{ margin: [0, 0, 0, 6], text: [{ text: 'x' }] }]);
		expect(tiptapToPdfContent(null, ctx)).toEqual([]);
		expect(tiptapToPdfContent(doc(p()), ctx)).toEqual([{ margin: [0, 0, 0, 6], text: ' ' }]);
	});
});

describe('helpers', () => {
	it('collects the images of Docs a page shows', () => {
		expect(collectImageIds(doc(p({ type: 'image', attrs: { src: `/api/plugins/docs/documents/${FILE}/raw` } }), { type: 'image', attrs: { src: 'https://x/y.png', documentId: PAGE } }))).toEqual([FILE, PAGE]);
	});

	it('formats sizes and reads text', () => {
		expect(formatBytes(512)).toBe('512 B');
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(undefined)).toBe('');
		expect(plainTextOf({ type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' }] })).toBe('a\nb');
	});
});
