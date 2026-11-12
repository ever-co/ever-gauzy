// cspell:ignore bolditalics Ähre Привет
import { PDFParse } from 'pdf-parse';
import { TINY_PNG } from '../import/__fixtures__/import-zip.fixture';
import { anchorOfPage, buildPdfDefinition, DOCS_PDF_FONT, pdfDateOf, pdfFileNameOf, pdfFonts, preparePdfImage, renderPdf } from './pdf-render';

const FILE = '11111111-2222-4333-8444-555555555555';
const PARENT = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const CHILD = 'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const page = (text: string, extra: unknown[] = []) => ({
	type: 'doc',
	content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] }, { type: 'paragraph', content: [{ type: 'text', text }] }, ...extra]
});

/** The text of a PDF, page by page. */
async function textOf(pdf: Buffer): Promise<{ total: number; text: string }> {
	const parser = new PDFParse({ data: new Uint8Array(pdf) });
	try {
		const result = await parser.getText();
		return { total: Number(result.total), text: result.pages.map((item: { text?: string }) => item.text ?? '').join('\n') };
	} finally {
		await parser.destroy();
	}
}

describe('pdf-render', () => {
	jest.setTimeout(60_000);

	it("loads the bundled font into pdfmake's in-memory file system (no path for the local access policy to allow)", () => {
		const fonts = pdfFonts()[DOCS_PDF_FONT];
		expect(fonts['normal']).toBe('gauzy-docs-fonts/Roboto-Regular.ttf');
		expect(fonts['bolditalics']).toBe('gauzy-docs-fonts/Roboto-MediumItalic.ttf');
	});

	it('renders one page with its header, footer, content and an embedded image', async () => {
		const image = await preparePdfImage(TINY_PNG, 'img0');
		expect(image).toMatchObject({ key: 'img0', width: 1, height: 1 });
		const definition = buildPdfDefinition(
			[{ id: PARENT, title: 'Release plan', contentJson: page('Ship it — vite, Ähre, Привет', [{ type: 'image', attrs: { src: `/api/plugins/docs/documents/${FILE}/raw` } }]), depth: 0 }],
			{ title: 'Release plan', date: '2026-11-11', images: new Map([[FILE, image as NonNullable<typeof image>]]), toc: false }
		);
		const pdf = await renderPdf(definition);
		expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
		const { total, text } = await textOf(pdf);
		expect(total).toBe(1);
		expect(text).toContain('Release plan');
		expect(text).toContain('2026-11-11');
		expect(text).toContain('1 / 1');
		expect(text).toContain('Ship it');
		expect(text).toContain('Привет');
	});

	it('renders a subtree as one PDF with a table of contents and a sheet per page', async () => {
		const definition = buildPdfDefinition(
			[
				{ id: PARENT, title: 'Handbook', contentJson: page('Welcome', [{ type: 'paragraph', content: [{ type: 'documentMention', attrs: { id: CHILD, label: 'Onboarding' } }] }]), depth: 0 },
				{ id: CHILD, title: 'Onboarding', contentJson: page('First day'), depth: 1 }
			],
			{ title: 'Handbook', date: '2026-11-11', images: new Map(), toc: true }
		);
		const content = definition['content'] as any[];
		expect(content[1]).toMatchObject({ toc: expect.any(Object), pageBreak: 'after' });
		expect(content.find((item) => item.id === anchorOfPage(CHILD))).toMatchObject({ tocItem: true, pageBreak: 'before', tocMargin: [12, 2, 0, 2] });
		const { total, text } = await textOf(await renderPdf(definition));
		expect(total).toBe(3);
		expect(text).toContain('Onboarding');
		expect(text).toContain('First day');
	});

	it('never fetches a URL: an external image is its text, and the policy refuses URLs', async () => {
		const definition = buildPdfDefinition(
			[{ id: PARENT, title: 'Remote', contentJson: page('x', [{ type: 'image', attrs: { src: 'https://example.com/a.png', alt: 'remote chart' } }]), depth: 0 }],
			{ title: 'Remote', date: '2026-11-11', images: new Map(), toc: false }
		);
		expect(JSON.stringify(definition['images'])).toBe('{}');
		const { text } = await textOf(await renderPdf(definition));
		expect(text).toContain('[remote chart]');
	});

	it('refuses a URL resource at the renderer itself, and fetches nothing', async () => {
		const fetchSpy = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in this test'));
		try {
			// A definition naming a remote image straight to pdfmake: only renderPdf's deny-all policy stands in the way.
			const definition = { content: [{ text: 'x' }, { image: 'remote' }], images: { remote: 'https://example.com/a.png' } };
			await expect(renderPdf(definition)).rejects.toThrow(/denied by resource access policy/);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
		}
	});

		it('refuses what is not an image', async () => {
		expect(await preparePdfImage(Buffer.from('not an image'), 'x')).toBeNull();
	});

	it('names files and dates locale-neutrally', () => {
		expect(pdfFileNameOf('Release plan: Q1')).toBe('release-plan-q1.pdf');
		expect(pdfFileNameOf('///')).toBe('document.pdf');
		expect(pdfDateOf(new Date('2026-01-02T23:00:00Z'))).toBe('2026-01-02');
	});
});
