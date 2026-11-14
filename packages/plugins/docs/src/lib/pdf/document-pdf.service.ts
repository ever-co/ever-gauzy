import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import { posix } from 'node:path';
import { ID, IDocumentPdfExportCapabilities } from '@gauzy/contracts';
import { FileContentTooLargeError } from '@gauzy/core';
import { getDocsConfig } from '../docs.config';
import { DOCS_PDF_TOO_MANY_PAGES } from '../docs.constants';
import { Document } from '../entities/document.entity';
import { DOCS_MARKDOWN_SUBTREE_MAX_PAGES, DocumentMarkdownService, ISubtreeEntry } from '../services/document-markdown.service';
import { DocumentUploadService } from '../services/document-upload.service';
import { buildPdfDefinition, IPdfPage, pdfDateOf, pdfFileNameOf, preparePdfImage, renderPdf } from './pdf-render';
import { collectImageIds, IPdfImage } from './tiptap-pdf';

/**
 * The most image bytes one PDF export holds; an image past the budget is its alternative text. The re-encoded images
 * count against it, and so does the file being read: an image file larger than what is left of the budget is not read
 * whole (see `DocumentPdfService.loadImages`).
 */
export const DOCS_PDF_IMAGES_MAX_BYTES = 64 * 1024 * 1024;

/**
 * The most pages a subtree PDF export can take, whatever `GAUZY_DOCS_PDF_MAX_PAGES` says: the subtree collection reads
 * at most {@link DOCS_MARKDOWN_SUBTREE_MAX_PAGES} pages, and the export reads one page past its limit to tell a subtree
 * at the limit from a larger one.
 */
export const DOCS_PDF_MAX_PAGES_CEILING = DOCS_MARKDOWN_SUBTREE_MAX_PAGES - 1;

/** The page limit of a subtree PDF export: the configured one, within 1 … {@link DOCS_PDF_MAX_PAGES_CEILING}. */
export function pdfMaxPages(): number {
	const configured = Math.floor(Number(getDocsConfig().pdfMaxPages));
	return Math.min(Math.max(Number.isFinite(configured) ? configured : 1, 1), DOCS_PDF_MAX_PAGES_CEILING);
}

/** The reader of a zip export went away before its end: the export stops. */
export class PdfExportCancelledError extends Error {
	constructor() {
		super('The reader closed the PDF export before its end');
		this.name = 'PdfExportCancelledError';
	}
}

/** An answer stream as the zip writer uses it: Express's response, or any writable. */
type ExportOutput = NodeJS.WritableStream & { headersSent?: boolean; destroy?: (error?: Error) => void };

/** A rendered PDF, named for a download. */
export interface IDocumentPdf {
	fileName: string;
	buffer: Buffer;
	pages: number;
}

/**
 * PDF export of a page or a subtree (`docs-import-export` spec FR-13 … FR-16), from the stored TipTap JSON with
 * pdfmake — no browser. Access is the Markdown export's: the page is read through `DocumentMarkdownService.requirePage`
 * (404 unreadable, 409 not a page), the subtree through its `collectSubtree` (readable pages only), and every image
 * through `DocumentUploadService.getRawFile` (the file's own read check), so a PDF never shows what its reader could
 * not open.
 */
@Injectable()
export class DocumentPdfService {
	private readonly logger = new Logger(DocumentPdfService.name);
	/** The most image bytes one export holds (`DOCS_PDF_IMAGES_MAX_BYTES`; a spec makes it small). */
	private readonly imagesMaxBytes: number = DOCS_PDF_IMAGES_MAX_BYTES;

	constructor(
		private readonly markdown: DocumentMarkdownService,
		private readonly uploads: DocumentUploadService
	) {}

	/** What the clients' probe answers. */
	capabilities(): IDocumentPdfExportCapabilities {
		return { maxPages: pdfMaxPages() };
	}

	/** The page the caller may read, as a page (the route's 404 / 409). */
	requirePage(id: ID, organizationId?: ID): Promise<Document> {
		return this.markdown.requirePage(id, organizationId);
	}

	/** One page as a PDF. */
	async renderPage(root: Document, organizationId?: ID): Promise<IDocumentPdf> {
		const pages: IPdfPage[] = [{ id: String(root.id), title: root.name, contentJson: root.contentJson, depth: 0 }];
		const buffer = await this.render(root.name, pages, organizationId, false);
		return { fileName: pdfFileNameOf(root.name), buffer, pages: 1 };
	}

	/** A page and the readable pages under it as one PDF with a table of contents. */
	async renderSubtree(root: Document, organizationId?: ID): Promise<IDocumentPdf> {
		const pages = await this.subtreePages(root, organizationId);
		const buffer = await this.render(root.name, pages, organizationId, true);
		return { fileName: pdfFileNameOf(root.name), buffer, pages: pages.length };
	}

	/**
	 * A page and the readable pages under it as a zip of PDFs, one per page, at the Markdown export's paths. One PDF is
	 * rendered at a time: the next once the zip has taken this one (and, through the pipe, the reader the bytes before
	 * it), so a slow reader holds at most one rendered page. A reader that goes away stops the export, also while the
	 * pages are collected; a page that fails to render aborts the zip (an answer already under way is cut, not left
	 * unfinished).
	 */
	async writeSubtreeZip(root: Document, organizationId: ID | undefined, output: ExportOutput): Promise<{ fileName: string; pages: number }> {
		const archive = new ZipArchive({ zlib: { level: 6 } });
		let finished = false;
		let cancelled = false;
		const done = new Promise<void>((resolve, reject) => {
			archive.on('error', (error: Error) => reject(error));
			output.on('finish', () => {
				finished = true;
				resolve();
			});
			// A close before the end is the reader going away (a full answer finishes first).
			output.on('close', () => {
				if (finished) return resolve();
				cancelled = true;
				reject(new PdfExportCancelledError());
			});
			output.on('error', (error: Error) => reject(error));
		});
		// Observed here; the loop and the end await it again.
		done.catch(() => undefined);
		// Collected once the reader is watched (one that leaves meanwhile stops the export before any page is rendered),
		// and before the zip is piped: a subtree past the limit is still answered 413, not as a cut zip.
		const entries = await this.subtreeEntries(root, organizationId);
		if (cancelled) throw new PdfExportCancelledError();
		archive.pipe(output);
		try {
			for (const entry of entries) {
				if (cancelled) throw new PdfExportCancelledError();
				const page: IPdfPage = { id: String(entry.document.id), title: entry.document.name, contentJson: entry.document.contentJson, depth: 0 };
				const buffer = await this.render(entry.document.name, [page], organizationId, false);
				if (cancelled) throw new PdfExportCancelledError();
				await Promise.race([appendEntry(archive, buffer, pdfPathOf(entry.path)), done]);
			}
			await Promise.resolve(archive.finalize());
			await done;
		} catch (error) {
			archive.abort();
			// Bytes of the zip went out (or the reader left): the answer cannot become an error any more, so it is cut.
			if (output.headersSent || cancelled) output.destroy?.();
			throw error;
		}
		return { fileName: pdfFileNameOf(root.name, 'pages').replace(/\.pdf$/, '.zip'), pages: entries.length };
	}

	/**
	 * The readable pages of a subtree in table-of-contents order (each page right after its parent, through folders),
	 * with their depth, folders counted (413 past `GAUZY_DOCS_PDF_MAX_PAGES`).
	 */
	private async subtreePages(root: Document, organizationId?: ID): Promise<IPdfPage[]> {
		const entries = await this.subtreeEntries(root, organizationId);
		return entries.map((entry) => ({
			id: String(entry.document.id),
			title: entry.document.name,
			contentJson: entry.document.contentJson,
			depth: entry.depth ?? 0
		}));
	}

	/**
	 * The readable pages of a subtree, depth first; 413 past the limit ({@link pdfMaxPages}), counted on one more page
	 * than the limit (and on a collection that stopped at its own cap), so a larger subtree is refused, never cut.
	 */
	private async subtreeEntries(root: Document, organizationId?: ID): Promise<ISubtreeEntry[]> {
		const max = pdfMaxPages();
		const { entries, truncated } = await this.markdown.collectSubtreeWithin(root, organizationId, max + 1);
		if (truncated) this.assertPageCount(Math.max(entries.length, max) + 1);
		this.assertPageCount(entries.length);
		return [...entries].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	}

	private assertPageCount(count: number): void {
		const max = pdfMaxPages();
		if (count > max) {
			throw new HttpException(
				{ statusCode: HttpStatus.PAYLOAD_TOO_LARGE, message: `The page has ${count} readable pages; a PDF export takes at most ${max}`, code: DOCS_PDF_TOO_MANY_PAGES },
				HttpStatus.PAYLOAD_TOO_LARGE
			);
		}
	}

	/** Loads the pages' images (within the budget) and renders the PDF. */
	private async render(title: string, pages: IPdfPage[], organizationId: ID | undefined, toc: boolean): Promise<Buffer> {
		const images = await this.loadImages(pages, organizationId);
		return renderPdf(buildPdfDefinition(pages, { title, date: pdfDateOf(), images, toc }));
	}

	/**
	 * The images the pages show, read with the caller's access, re-encoded, within {@link DOCS_PDF_IMAGES_MAX_BYTES}.
	 *
	 * Each file is read within what is left of the budget, so the export never holds more image bytes than its budget,
	 * the file being read included: a file whose stored size is past what is left is not read at all, one of no stored
	 * size is abandoned at that bound while it is read, and with nothing left nothing more is read. Such an image is
	 * left out (its alternative text stands in) even when its re-encoded copy would have fit, as the file is held whole
	 * while it is re-encoded. The re-encoded copy is then counted against the budget, as before.
	 */
	private async loadImages(pages: IPdfPage[], organizationId?: ID): Promise<Map<string, IPdfImage & { dataUrl: string }>> {
		const images = new Map<string, IPdfImage & { dataUrl: string }>();
		let total = 0;
		const ids = new Set<string>();
		for (const page of pages) for (const id of collectImageIds(page.contentJson)) ids.add(id);
		for (const id of ids) {
			// With nothing left, nothing is read (a bound of 0 is no bound to the storage read).
			const remaining = this.imagesMaxBytes - total;
			if (remaining <= 0) {
				this.warnPastBudget(id);
				continue;
			}
			try {
				const file = await this.uploads.getRawFile(id as ID, organizationId, { maxBytes: remaining });
				const image = await preparePdfImage(file.buffer, `img${images.size}`);
				if (!image) continue;
				if (total + image.bytes > this.imagesMaxBytes) {
					this.warnPastBudget(id);
					continue;
				}
				total += image.bytes;
				images.set(id, image);
			} catch (error) {
				if (error instanceof FileContentTooLargeError && error.maxBytes >= remaining) {
					this.warnPastBudget(id);
					continue;
				}
				// Not the caller's to read, gone, past the per-file limit, or not an image: its alternative text stands in.
				this.logger.debug?.(`PDF export: image ${id} left out (${(error as Error)?.message ?? error})`);
			}
		}
		return images;
	}

	/** Logs an image left out of an export because it does not fit what is left of the image budget. */
	private warnPastBudget(id: string): void {
		this.logger.warn(
			`PDF export: image ${id} left out (the export's image budget of ${this.imagesMaxBytes} bytes is reached)`
		);
	}
}

/** Appends one entry to the zip and resolves once the zip has taken it (its `entry` event), or rejects on its error. */
function appendEntry(archive: ZipArchive, buffer: Buffer, name: string): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const onEntry = () => {
			cleanup();
			resolve();
		};
		const onError = (error: Error) => {
			cleanup();
			reject(error);
		};
		const cleanup = () => {
			archive.off('entry', onEntry);
			archive.off('error', onError);
		};
		archive.on('entry', onEntry);
		archive.on('error', onError);
		archive.append(buffer, { name });
	});
}

/** The path a page takes in the zip of PDFs (the Markdown export's, `.pdf`). */
export function pdfPathOf(markdownPath: string): string {
	return posix.normalize(markdownPath).replace(/\.md$/, '.pdf');
}
