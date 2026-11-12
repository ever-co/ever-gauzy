// cspell:ignore virtualfs bolditalics
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as pdfmake from 'pdfmake';
import * as sharpModule from 'sharp';
import { IPdfImage, IPdfRenderContext, PDF_STYLES, PdfContent, tiptapToPdfContent } from './tiptap-pdf';

// sharp 0.35 types its entry point as an ES module (a default export), while `require('sharp')` returns the function.
const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ?? sharpModule) as unknown as typeof sharpModule.default;

/** The font family the Docs PDFs use (Roboto, bundled with pdfmake: Latin, Greek, Cyrillic). */
export const DOCS_PDF_FONT = 'DocsRoboto';

/** The standard font the platform's invoices use, kept usable whatever this module registers. */
const HELVETICA_NAMES: ReadonlySet<string> = new Set(['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique']);

/** A4 in points, and the margins the content width follows from. */
const PAGE = { width: 595.28, height: 841.89, margin: { left: 48, top: 64, right: 48, bottom: 56 } };
export const PDF_CONTENT_WIDTH = PAGE.width - PAGE.margin.left - PAGE.margin.right;

/** The widest an embedded image is stored, in pixels (a phone photo is 4000 px; a sheet is 500 pt). */
const IMAGE_MAX_PIXELS = 1600;

/** The pdfmake instance's surface this module uses (the library ships no types). */
interface IPdfEngine {
	fonts?: Record<string, unknown>;
	virtualfs: { existsSync(name: string): boolean; writeFileSync(name: string, content: Buffer): void };
	setFonts(fonts: unknown): void;
	setUrlAccessPolicy(callback: (url: string) => boolean): void;
	setLocalAccessPolicy(callback: (path: string) => boolean): void;
	localAccessPolicy?: unknown;
	createPdf(definition: unknown, options: unknown): { getStream(): Promise<NodeJS.ReadableStream & { end(): void }> };
}

const engine = pdfmake as unknown as IPdfEngine;

/** The bundled Roboto files and the names they take in pdfmake's in-memory file system. */
const ROBOTO = { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' } as const;
const VFS_PREFIX = 'gauzy-docs-fonts/';

let fonts: Record<string, Record<string, string>> | null = null;

/**
 * The font descriptors. The bundled Roboto files are read once into pdfmake's in-memory file system and named by
 * their in-memory names: pdfmake reads a font it finds there without asking the local access policy, and resolves no
 * URL for it (a font descriptor that is a buffer is not supported: pdfmake takes it for a URL object). Helvetica, the
 * standard font, when the files cannot be read (an install without them).
 */
export function pdfFonts(): Record<string, Record<string, string>> {
	if (fonts) return fonts;
	try {
		const root = join(dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');
		const family: Record<string, string> = {};
		for (const [style, file] of Object.entries(ROBOTO)) {
			const name = `${VFS_PREFIX}${file}`;
			if (!engine.virtualfs.existsSync(name)) engine.virtualfs.writeFileSync(name, readFileSync(join(root, file)));
			family[style] = name;
		}
		fonts = { [DOCS_PDF_FONT]: family };
	} catch {
		fonts = { [DOCS_PDF_FONT]: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } };
	}
	return fonts;
}

/** One page of a PDF: its title, its stored JSON, and its place in the table of contents. */
export interface IPdfPage {
	id: string;
	title: string;
	contentJson: unknown;
	/** Its depth below the exported page (0 for the page itself). */
	depth: number;
}

/** What the header says and what the images are. */
export interface IPdfDocumentOptions {
	/** The header's title (the exported page's). */
	title: string;
	/** The export's date as the header shows it (`YYYY-MM-DD`). */
	date: string;
	/** Loaded images by document id. */
	images: Map<string, IPdfImage & { dataUrl: string }>;
	/** A table of contents (a subtree export). */
	toc: boolean;
}

/** The in-PDF destination of a page. */
export const anchorOfPage = (id: string): string => `page-${String(id).replace(/[^a-zA-Z0-9-]/g, '')}`;

/**
 * The pdfmake document definition of one page or several (a subtree): a header with the title and the date on every
 * sheet, `page / pages` in the footer, each page's title as a heading (a table-of-contents entry, from a new sheet
 * after the first), the pages' content, and the images by key.
 */
export function buildPdfDefinition(pages: IPdfPage[], options: IPdfDocumentOptions): Record<string, unknown> {
	const inPdf = new Set(pages.map((page) => String(page.id)));
	const images: Record<string, string> = {};
	for (const image of options.images.values()) images[image.key] = image.dataUrl;
	const ctx: IPdfRenderContext = {
		contentWidth: PDF_CONTENT_WIDTH,
		imageOf: (id) => options.images.get(id) ?? null,
		anchorOf: (id) => (inPdf.has(String(id)) ? anchorOfPage(id) : null)
	};
	const content: PdfContent[] = [];
	if (options.toc && pages.length > 1) {
		content.push({ text: options.title, style: 'pageTitle' });
		content.push({ toc: { numberStyle: { color: '#555555' } }, pageBreak: 'after' });
	}
	pages.forEach((page, index) => {
		content.push({
			text: page.title,
			style: 'pageTitle',
			id: anchorOfPage(page.id),
			...(options.toc && pages.length > 1 ? { tocItem: true, tocMargin: [Math.min(page.depth, 6) * 12, 2, 0, 2], tocStyle: page.depth === 0 ? { bold: true } : {} } : {}),
			...(index > 0 ? { pageBreak: 'before' } : {})
		});
		content.push(...tiptapToPdfContent(page.contentJson, ctx));
	});
	return {
		pageSize: 'A4',
		pageMargins: [PAGE.margin.left, PAGE.margin.top, PAGE.margin.right, PAGE.margin.bottom],
		info: { title: options.title, creator: 'Docs', producer: 'Docs' },
		header: () => ({
			columns: [
				{ text: options.title, bold: true, noWrap: false, width: '*' },
				{ text: options.date, alignment: 'right', width: 'auto' }
			],
			fontSize: 8,
			color: '#555555',
			margin: [PAGE.margin.left, 28, PAGE.margin.right, 0]
		}),
		footer: (currentPage: number, pageCount: number) => ({ text: `${currentPage} / ${pageCount}`, alignment: 'center', fontSize: 8, color: '#555555', margin: [0, 20, 0, 0] }),
		content,
		images,
		styles: PDF_STYLES,
		defaultStyle: { font: DOCS_PDF_FONT, fontSize: 10.5, lineHeight: 1.25 }
	};
}

/**
 * Renders a definition to PDF bytes.
 *
 * pdfmake 0.3 is one module-wide instance that reads its fonts and access policies when `createPdf` is called; they
 * are set right before, synchronously, so the call takes these. The family is ADDED (the invoices' Helvetica stays),
 * every URL is denied (no image or font is ever fetched — CVE-2026-26801), and the local policy is the platform's
 * when it set one (Helvetica's names only otherwise): this module only passes buffers and data URLs.
 */
export async function renderPdf(definition: Record<string, unknown>): Promise<Buffer> {
	// A shallow merge, and a fresh copy of each family: pdfmake rewrites the descriptors it is handed while it resolves them.
	const own = Object.fromEntries(Object.entries(pdfFonts()).map(([name, family]) => [name, { ...family }]));
	engine.setFonts({ ...(engine.fonts ?? {}), ...own });
	engine.setUrlAccessPolicy(() => false);
	if (typeof engine.localAccessPolicy !== 'function') engine.setLocalAccessPolicy((path: string) => HELVETICA_NAMES.has(path));
	const stream = await engine.createPdf(definition, {}).getStream();
	return new Promise<Buffer>((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on('data', (chunk: Buffer) => chunks.push(chunk));
		stream.on('error', reject);
		stream.on('end', () => {
			const pdf = Buffer.concat(chunks);
			if (!pdf.length) reject(new Error('PDF generation produced no bytes'));
			else resolve(pdf);
		});
		stream.end();
	});
}

/**
 * An image file of Docs, made embeddable: rotated by its EXIF, at most {@link IMAGE_MAX_PIXELS} wide, re-encoded as
 * JPEG (an opaque photo) or PNG (anything with transparency; GIF and WebP, which pdfkit cannot read, included).
 * Null when it is not an image `sharp` can read.
 */
export async function preparePdfImage(buffer: Buffer, key: string): Promise<(IPdfImage & { dataUrl: string; bytes: number }) | null> {
	try {
		const image = sharp(buffer, { failOn: 'none', animated: false }).rotate();
		const meta = await image.metadata();
		if (!meta.width || !meta.height) return null;
		const resized = meta.width > IMAGE_MAX_PIXELS ? image.resize({ width: IMAGE_MAX_PIXELS, withoutEnlargement: true }) : image;
		const asJpeg = meta.format === 'jpeg' && !meta.hasAlpha;
		const { data, info } = await (asJpeg ? resized.jpeg({ quality: 82 }) : resized.png({ compressionLevel: 8 })).toBuffer({ resolveWithObject: true });
		return { key, width: info.width, height: info.height, dataUrl: `data:image/${asJpeg ? 'jpeg' : 'png'};base64,${data.toString('base64')}`, bytes: data.length };
	} catch {
		return null;
	}
}

/** The export's date as the header shows it: `YYYY-MM-DD`, the same in every language. */
export function pdfDateOf(date: Date = new Date()): string {
	return date.toISOString().slice(0, 10);
}

/** A file name for a PDF: the page's name as a slug, `.pdf`. */
export function pdfFileNameOf(name: unknown, fallback = 'document'): string {
	const slug = String(name ?? '')
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return `${slug || fallback}.pdf`;
}
