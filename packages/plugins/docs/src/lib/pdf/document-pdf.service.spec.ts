/**
 * The zip of PDFs (`docs-import-export` spec FR-15, FR-16): one page rendered at a time, a reader that goes away stops
 * the export, a page that fails aborts the zip, a subtree past the page limit is refused (never cut), and the table of
 * contents keeps each page under its parent through folders. Rendering itself is `pdf-render.spec.ts`'s.
 */
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../services/document-markdown.service', () => ({ DocumentMarkdownService: class {}, DOCS_MARKDOWN_SUBTREE_MAX_PAGES: 500 }));
jest.mock('../services/document-upload.service', () => ({ DocumentUploadService: class {} }));

import { HttpException } from '@nestjs/common';
import { PassThrough } from 'node:stream';
import { DOCS_PDF_TOO_MANY_PAGES, ENV_GAUZY_DOCS_PDF_MAX_PAGES } from '../docs.constants';
import { DOCS_PDF_MAX_PAGES_CEILING, DocumentPdfService, PdfExportCancelledError, pdfMaxPages } from './document-pdf.service';

const page = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
	document: { id, name, contentJson: { type: 'doc', content: [] } },
	path: id === 'root' ? 'index.md' : `${name}.md`,
	hasChildren: false,
	...extra
});

function build(entries: ReturnType<typeof page>[], truncated = false) {
	const markdown = { collectSubtreeWithin: jest.fn(async () => ({ entries, truncated })) };
	const service = new DocumentPdfService(markdown as never, {} as never);
	const render = jest.spyOn(service as never as { render: (...args: unknown[]) => Promise<Buffer> }, 'render');
	return { service, render, markdown };
}

const ROOT = { id: 'root', name: 'Root' } as never;

describe('DocumentPdfService zip of PDFs', () => {
	it('writes one PDF per page and finishes the answer', async () => {
		const { service, render } = build([page('root', 'Root'), page('a', 'A'), page('b', 'B')]);
		render.mockResolvedValue(Buffer.from('%PDF-1.7'));
		const output = new PassThrough();
		output.resume();
		await expect(service.writeSubtreeZip(ROOT, undefined, output)).resolves.toMatchObject({ pages: 3 });
		expect(render).toHaveBeenCalledTimes(3);
	});

	it('stops when the reader goes away, and renders nothing more', async () => {
		const { service, render } = build([page('root', 'Root'), page('a', 'A'), page('b', 'B'), page('c', 'C')]);
		const output = new PassThrough();
		output.resume();
		render.mockImplementation(async () => {
			// The reader leaves while the second page renders.
			if (render.mock.calls.length === 2) output.destroy();
			await new Promise((resolve) => setImmediate(resolve));
			return Buffer.from('%PDF-1.7');
		});
		await expect(service.writeSubtreeZip(ROOT, undefined, output)).rejects.toBeInstanceOf(PdfExportCancelledError);
		expect(render).toHaveBeenCalledTimes(2);
	});

	it('aborts the zip when a page fails, and cuts an answer already under way', async () => {
		const { service, render } = build([page('root', 'Root'), page('a', 'A'), page('b', 'B')]);
		render.mockResolvedValueOnce(Buffer.from('%PDF-1.7')).mockRejectedValueOnce(new Error('render failed'));
		const output = Object.assign(new PassThrough(), { headersSent: true });
		output.resume();
		await expect(service.writeSubtreeZip(ROOT, undefined, output)).rejects.toThrow('render failed');
		expect(output.destroyed).toBe(true);
		expect(render).toHaveBeenCalledTimes(2);
	});

	it('refuses a subtree the collection stopped at its limit, rather than exporting part of it', async () => {
		const { service, render, markdown } = build([page('root', 'Root'), page('a', 'A')], true);
		const output = new PassThrough();
		const refusal = service.writeSubtreeZip(ROOT, undefined, output);
		await expect(refusal).rejects.toBeInstanceOf(HttpException);
		await expect(refusal).rejects.toMatchObject({ response: { code: DOCS_PDF_TOO_MANY_PAGES } });
		expect(render).not.toHaveBeenCalled();
		// One page past the limit is asked for, so a subtree of exactly the limit passes.
		expect(markdown.collectSubtreeWithin).toHaveBeenCalledWith(ROOT, undefined, expect.any(Number));
	});

	it('stops before rendering anything when the reader leaves while the pages are collected', async () => {
		const output = new PassThrough();
		output.resume();
		const { service, render, markdown } = build([page('root', 'Root'), page('a', 'A')]);
		markdown.collectSubtreeWithin.mockImplementation(async () => {
			output.destroy();
			await new Promise((resolve) => setImmediate(resolve));
			return { entries: [page('root', 'Root'), page('a', 'A')], truncated: false };
		});
		await expect(service.writeSubtreeZip(ROOT, undefined, output)).rejects.toBeInstanceOf(PdfExportCancelledError);
		expect(render).not.toHaveBeenCalled();
	});

	it('keeps a raised page limit within what the subtree collection reads', async () => {
		const saved = process.env[ENV_GAUZY_DOCS_PDF_MAX_PAGES];
		process.env[ENV_GAUZY_DOCS_PDF_MAX_PAGES] = '600';
		try {
			expect(pdfMaxPages()).toBe(DOCS_PDF_MAX_PAGES_CEILING);
			const { service, markdown, render } = build([page('root', 'Root')]);
			render.mockResolvedValue(Buffer.from('%PDF-1.7'));
			expect(service.capabilities()).toEqual({ maxPages: DOCS_PDF_MAX_PAGES_CEILING });
			// One page past the limit, and no more than the collection's own cap (500): a 550-page subtree is a 413.
			await expect(service.renderSubtree(ROOT)).resolves.toBeDefined();
			expect(markdown.collectSubtreeWithin).toHaveBeenCalledWith(ROOT, undefined, DOCS_PDF_MAX_PAGES_CEILING + 1);
		} finally {
			if (saved === undefined) delete process.env[ENV_GAUZY_DOCS_PDF_MAX_PAGES];
			else process.env[ENV_GAUZY_DOCS_PDF_MAX_PAGES] = saved;
		}
	});

	it('orders the table of contents depth first, each page under its parent through folders', async () => {
		const { service, render } = build([
			page('root', 'Root', { depth: 0, order: 0 }),
			page('c', 'C', { depth: 1, order: 4 }),
			page('a', 'A', { depth: 2, order: 2 }),
			page('b', 'B', { depth: 3, order: 3 })
		]);
		render.mockResolvedValue(Buffer.from('%PDF-1.7'));
		await service.renderSubtree(ROOT);
		const pages = render.mock.calls[0][1] as { title: string; depth: number }[];
		expect(pages.map((entry) => [entry.title, entry.depth])).toEqual([
			['Root', 0],
			['A', 2],
			['B', 3],
			['C', 1]
		]);
	});
});
