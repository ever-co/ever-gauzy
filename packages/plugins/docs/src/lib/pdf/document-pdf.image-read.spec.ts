/**
 * The PDF export reads each image file within what is left of its image budget (`DOCS_PDF_IMAGES_MAX_BYTES`), through
 * the real raw read (`DocumentUploadService.getRawFile`) and the real storage read (`readStorageFileAsBuffer`). Before,
 * every image file was read whole, up to the per-file limit, and only its re-encoded copy was then checked against the
 * budget: a file far larger than what was left was still read into memory (and re-encoded) to be thrown away.
 *
 * The files are streams of 64 KiB chunks, as the S3 family answers, far larger than the budget and than any buffer of
 * the stream: a read that is abandoned at the bound pulls a few chunks past it at most, never the file.
 */
const providerStub = { getFile: jest.fn() };

jest.mock('@gauzy/core', () => ({
	// The real storage read helper (dependency-free), so the reads are bounded as the providers' are.
	...jest.requireActual('@gauzy/core/src/lib/core/file-storage/helpers/stored-file-content'),
	FileStorage: class {
		setProvider() {
			return this;
		}
		getProviderInstance() {
			return providerStub;
		}
	},
	RequestContext: { currentTenantId: () => 'tenant-1', currentOrganizationId: () => 'org-1' }
}));
jest.mock('../docs.config', () => ({ getDocsConfig: () => ({ maxFileSize: 50 * 1024 * 1024, pdfMaxPages: 200 }) }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('../services/document.service', () => ({ DocumentService: class {} }));
jest.mock('../services/document-settings.service', () => ({ DocumentSettingsService: class {} }));
jest.mock('../services/document-quota.service', () => ({ DocumentQuotaService: class {} }));
jest.mock('../services/document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('../services/document-markdown.service', () => ({
	DocumentMarkdownService: class {},
	DOCS_MARKDOWN_SUBTREE_MAX_PAGES: 500
}));
jest.mock('../dto', () => ({}));

import { Logger } from '@nestjs/common';
import { Readable } from 'node:stream';
import * as sharpModule from 'sharp';
import { DocumentKindEnum } from '@gauzy/contracts';
import { DocumentUploadService } from '../services/document-upload.service';
import { DOCS_PDF_IMAGES_MAX_BYTES, DocumentPdfService } from './document-pdf.service';
import { preparePdfImage } from './pdf-render';

// sharp 0.35 types its entry point as an ES module (a default export), while `require('sharp')` returns the function.
const sharp = ((sharpModule as unknown as { default?: typeof sharpModule.default }).default ??
	sharpModule) as unknown as typeof sharpModule.default;

const KIB = 1024;
const MIB = 1024 * KIB;
const CHUNK = 64 * KIB;

/** A stored file read as a stream of 64 KiB chunks, made as they are pulled; `pulled()` is how many bytes were. */
function streamOf(total: number) {
	let pulled = 0;
	const stream = new Readable({
		highWaterMark: CHUNK,
		read() {
			if (pulled >= total) {
				this.push(null);
				return;
			}
			const size = Math.min(CHUNK, total - pulled);
			pulled += size;
			this.push(Buffer.alloc(size, 0xab));
		}
	});
	return { stream, pulled: () => pulled };
}

/** A file document of the Documents API (`fileSize` null: a size that was never stored). */
const fileRow = (id: string, fileSize: number | null = null) => ({
	id,
	kind: DocumentKindEnum.FILE,
	name: `${id}.png`,
	originalFilename: `${id}.png`,
	mimeType: 'image/png',
	storageProvider: 'DIGITALOCEAN',
	storageKey: `documents/tenant-1/org-1/${id}.png`,
	fileSize
});

/** One page showing the images, by their file documents. */
const pageShowing = (...ids: string[]) => ({
	id: 'page',
	title: 'Page',
	depth: 0,
	contentJson: {
		type: 'doc',
		content: ids.map((documentId) => ({
			type: 'image',
			attrs: { src: `/api/plugins/docs/documents/${documentId}/raw`, documentId }
		}))
	}
});

let png: Buffer;
beforeAll(async () => {
	png = await sharp({ create: { width: 48, height: 32, channels: 3, background: { r: 200, g: 40, b: 40 } } })
		.png()
		.toBuffer();
});

beforeEach(() => providerStub.getFile.mockReset());
afterEach(() => jest.restoreAllMocks());

/** The export, over the real raw read; the budget is `budget` bytes when given, the platform's otherwise. */
function exportWith(
	rows: Record<string, ReturnType<typeof fileRow>>,
	contents: Record<string, () => unknown>,
	budget?: number
) {
	const documentService = { findOneScoped: jest.fn(async (id: string) => rows[id]) };
	const uploads = new DocumentUploadService(
		{} as never,
		documentService as never,
		{} as never,
		{} as never,
		{} as never
	);
	providerStub.getFile.mockImplementation(async (key: string) =>
		contents[key.slice(key.lastIndexOf('/') + 1, -'.png'.length)]()
	);
	const service = new DocumentPdfService({} as never, uploads);
	if (budget !== undefined) Object.assign(service, { imagesMaxBytes: budget });
	const loadImages = (...ids: string[]) =>
		(
			service as unknown as {
				loadImages: (pages: unknown[], organizationId?: string) => Promise<Map<string, unknown>>;
			}
		).loadImages([pageShowing(...ids)], 'org-1');
	return { uploads, loadImages };
}

describe('DocumentPdfService — image files are read within what is left of the image budget', () => {
	it('abandons a file past what is left while it streams, and still embeds the next image that fits', async () => {
		const big = streamOf(8 * MIB);
		const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		const { loadImages } = exportWith(
			{ big: fileRow('big'), small: fileRow('small') },
			{ big: () => big.stream, small: () => png },
			1 * MIB
		);

		const images = await loadImages('big', 'small');

		expect([...images.keys()]).toEqual(['small']);
		// Abandoned at the 1 MiB bound: the chunk that crossed it, and at most one the stream had made ready.
		expect(big.pulled()).toBeLessThanOrEqual(1 * MIB + 2 * CHUNK);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("image big left out (the export's image budget"));
	});

	it('does not fetch a file whose stored size is past what is left', async () => {
		const { loadImages } = exportWith(
			{ big: fileRow('big', 8 * MIB), small: fileRow('small', png.length) },
			{ big: () => streamOf(8 * MIB).stream, small: () => png },
			1 * MIB
		);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		const images = await loadImages('big', 'small');

		expect([...images.keys()]).toEqual(['small']);
		expect(providerStub.getFile.mock.calls.map(([key]) => key)).toEqual(['documents/tenant-1/org-1/small.png']);
	});

	it('reads nothing more once the budget is spent', async () => {
		// An image file that is already what the export makes of it, and a budget of exactly its size.
		const prepared = await preparePdfImage(png, 'probe');
		const embedded = Buffer.from(String(prepared?.dataUrl).split(',')[1], 'base64');
		expect((await preparePdfImage(embedded, 'again'))?.bytes).toBe(embedded.length);
		const { loadImages } = exportWith(
			{ first: fileRow('first'), second: fileRow('second') },
			{ first: () => embedded, second: () => embedded },
			embedded.length
		);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		const images = await loadImages('first', 'second');

		expect([...images.keys()]).toEqual(['first']);
		expect(providerStub.getFile).toHaveBeenCalledTimes(1);
	});

	it('bounds the first read by the whole budget, and a later one by what the images before it left', async () => {
		const prepared = await preparePdfImage(png, 'probe');
		const { uploads, loadImages } = exportWith(
			{ first: fileRow('first'), second: fileRow('second') },
			{ first: () => png, second: () => png }
		);
		const read = jest.spyOn(uploads, 'getRawFile');

		await loadImages('first', 'second');

		expect(read.mock.calls).toEqual([
			['first', 'org-1', { maxBytes: DOCS_PDF_IMAGES_MAX_BYTES }],
			['second', 'org-1', { maxBytes: DOCS_PDF_IMAGES_MAX_BYTES - (prepared?.bytes ?? 0) }]
		]);
	});
});
