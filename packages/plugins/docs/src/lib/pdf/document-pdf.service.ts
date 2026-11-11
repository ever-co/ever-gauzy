import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import { posix } from 'node:path';
import { ID, IDocumentPdfExportCapabilities } from '@gauzy/contracts';
import { getDocsConfig } from '../docs.config';
import { DOCS_PDF_TOO_MANY_PAGES } from '../docs.constants';
import { Document } from '../entities/document.entity';
import { DocumentMarkdownService } from '../services/document-markdown.service';
import { DocumentUploadService } from '../services/document-upload.service';
import { buildPdfDefinition, IPdfPage, pdfDateOf, pdfFileNameOf, preparePdfImage, renderPdf } from './pdf-render';
import { collectImageIds, IPdfImage } from './tiptap-pdf';

/** The most image bytes (after re-encoding) one PDF export holds; an image past the budget is its alternative text. */
export const DOCS_PDF_IMAGES_MAX_BYTES = 64 * 1024 * 1024;

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

	constructor(
		private readonly markdown: DocumentMarkdownService,
		private readonly uploads: DocumentUploadService
	) {}

	/** What the clients' probe answers. */
	capabilities(): IDocumentPdfExportCapabilities {
		return { maxPages: getDocsConfig().pdfMaxPages };
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

	/** A page and the readable pages under it as a zip of PDFs, one per page, at the Markdown export's paths. */
	async writeSubtreeZip(root: Document, organizationId: ID | undefined, output: NodeJS.WritableStream): Promise<{ fileName: string; pages: number }> {
		const entries = await this.markdown.collectSubtree(root, organizationId);
		this.assertPageCount(entries.length);
		const archive = new ZipArchive({ zlib: { level: 6 } });
		const done = new Promise<void>((resolve, reject) => {
			archive.on('error', (error: Error) => reject(error));
			output.on('finish', () => resolve());
			output.on('close', () => resolve());
			output.on('error', (error: Error) => reject(error));
		});
		archive.pipe(output);
		for (const entry of entries) {
			const page: IPdfPage = { id: String(entry.document.id), title: entry.document.name, contentJson: entry.document.contentJson, depth: 0 };
			const buffer = await this.render(entry.document.name, [page], organizationId, false);
			archive.append(buffer, { name: pdfPathOf(entry.path) });
		}
		await Promise.resolve(archive.finalize());
		await done;
		return { fileName: pdfFileNameOf(root.name, 'pages').replace(/\.pdf$/, '.zip'), pages: entries.length };
	}

	/** The readable pages of a subtree, breadth first, with their depth (413 past `GAUZY_DOCS_PDF_MAX_PAGES`). */
	private async subtreePages(root: Document, organizationId?: ID): Promise<IPdfPage[]> {
		const entries = await this.markdown.collectSubtree(root, organizationId);
		this.assertPageCount(entries.length);
		// Breadth first gives parents before children; the table of contents wants each page right after its parent.
		const children = new Map<string, typeof entries>();
		for (const entry of entries.slice(1)) {
			const parentId = String(entry.document.parentId ?? '');
			children.set(parentId, [...(children.get(parentId) ?? []), entry]);
		}
		const ordered: IPdfPage[] = [];
		const visit = (entry: (typeof entries)[number], depth: number) => {
			ordered.push({ id: String(entry.document.id), title: entry.document.name, contentJson: entry.document.contentJson, depth });
			for (const child of children.get(String(entry.document.id)) ?? []) visit(child, depth + 1);
		};
		visit(entries[0], 0);
		// A page under a folder (whose folder is not in the list) still belongs in the PDF: after the rest, one level in.
		const seen = new Set(ordered.map((page) => page.id));
		for (const entry of entries) {
			if (!seen.has(String(entry.document.id))) ordered.push({ id: String(entry.document.id), title: entry.document.name, contentJson: entry.document.contentJson, depth: 1 });
		}
		return ordered;
	}

	private assertPageCount(count: number): void {
		const max = getDocsConfig().pdfMaxPages;
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

	/** The images the pages show, read with the caller's access, re-encoded, within {@link DOCS_PDF_IMAGES_MAX_BYTES}. */
	private async loadImages(pages: IPdfPage[], organizationId?: ID): Promise<Map<string, IPdfImage & { dataUrl: string }>> {
		const images = new Map<string, IPdfImage & { dataUrl: string }>();
		let total = 0;
		const ids = new Set<string>();
		for (const page of pages) for (const id of collectImageIds(page.contentJson)) ids.add(id);
		for (const id of ids) {
			try {
				const file = await this.uploads.getRawFile(id as ID, organizationId);
				const image = await preparePdfImage(file.buffer, `img${images.size}`);
				if (!image) continue;
				if (total + image.bytes > DOCS_PDF_IMAGES_MAX_BYTES) {
					this.logger.warn(`PDF export: image ${id} left out (the export's image budget is reached)`);
					continue;
				}
				total += image.bytes;
				images.set(id, image);
			} catch (error) {
				// Not the caller's to read, gone, or not an image: its alternative text stands in.
				this.logger.debug?.(`PDF export: image ${id} left out (${(error as Error)?.message ?? error})`);
			}
		}
		return images;
	}
}

/** The path a page takes in the zip of PDFs (the Markdown export's, `.pdf`). */
export function pdfPathOf(markdownPath: string): string {
	return posix.normalize(markdownPath).replace(/\.md$/, '.pdf');
}
