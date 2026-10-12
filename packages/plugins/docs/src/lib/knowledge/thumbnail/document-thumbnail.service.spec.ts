/**
 * Thumbnail generation (07 §4.4).
 *
 * A thumbnail is **cosmetic**, and every test here exists to pin that word down: whatever
 * goes wrong — unreadable bytes, a storage provider that rejects the write, a repository
 * that throws, a PDF in a process with no rasterizer — the method returns an outcome and
 * touches nothing else. It has no access to `status` or `knowledgeStatus` by construction,
 * and it must never reject, because the caller runs it on an already-`READY` document.
 *
 * The second pinned rule is idempotence: a document that already has a `thumbKey` is skipped
 * unless the job explicitly asks for a regeneration, so a reprocess, a recovery sweep or a
 * duplicate enqueue costs nothing.
 *
 * `@gauzy/core` boots the whole application graph on import, so `FileStorage` is stubbed at
 * the module boundary; `sharp` is real.
 */
const providerStub = {
	getFile: jest.fn(),
	putFile: jest.fn(),
	url: jest.fn()
};

jest.mock(
	'@gauzy/core',
	() => ({
		FileStorage: class {
			setProvider() {
				return this;
			}
			getProviderInstance() {
				return providerStub;
			}
		}
	}),
	{ virtual: true }
);
jest.mock('../../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));

import * as sharp from 'sharp';
import { DocumentKindEnum } from '@gauzy/contracts';
import { DocumentThumbnailService } from './document-thumbnail.service';
import { DOCS_THUMBNAIL_MAX_PX, isThumbnailableMime, thumbnailKeyFor } from './thumbnail.constants';

/** A real 600x400 PNG, so `sharp` genuinely resizes rather than being mocked away. */
const realPng = async (): Promise<Buffer> =>
	sharp({ create: { width: 600, height: 400, channels: 3, background: { r: 12, g: 90, b: 200 } } })
		.png()
		.toBuffer();

const documentRow = (overrides: Record<string, any> = {}): any => ({
	id: 'doc-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	kind: DocumentKindEnum.FILE,
	mimeType: 'image/png',
	storageKey: 'docs/org-1/diagram.png',
	storageProvider: 'LOCAL',
	thumbKey: null,
	...overrides
});

const JOB = { documentId: 'doc-1', tenantId: 'tenant-1', organizationId: 'org-1', reason: 'upload' as const };

/**
 * Builds the service with a recording repository and a stub rasterizer.
 *
 * @param overrides `renderPages` — what the PDF rasterizer answers.
 */
const buildService = (overrides: { renderPages?: jest.Mock; update?: jest.Mock } = {}) => {
	const update = overrides.update ?? jest.fn(async () => ({ affected: 1 }));
	const repository: any = { update };
	const renderPages = overrides.renderPages ?? jest.fn(async () => null);
	const rasterizer: any = { renderPages, isAvailable: jest.fn(async () => true) };

	const service = new DocumentThumbnailService(repository, rasterizer);
	jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
	jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);

	return { service, update, renderPages };
};

beforeEach(() => {
	jest.clearAllMocks();
	providerStub.putFile.mockResolvedValue({ key: undefined });
});

describe('isThumbnailableMime / thumbnailKeyFor', () => {
	it('claims images and PDFs, and nothing else', () => {
		for (const mime of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']) {
			expect(isThumbnailableMime(mime)).toBe(true);
		}
		for (const mime of [
			'text/plain',
			'text/csv',
			'text/html',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			undefined,
			null,
			''
		]) {
			expect(isThumbnailableMime(mime as any)).toBe(false);
		}
	});

	it('keeps the thumbnail beside its source so key-shape guards cover it too', () => {
		expect(thumbnailKeyFor('docs/org-1/diagram.png')).toBe('docs/org-1/diagram-thumb.webp');
		expect(thumbnailKeyFor('docs/org-1/report.pdf')).toBe('docs/org-1/report-thumb.webp');
		// A key with no extension still gets one thumbnail key, not a mangled one.
		expect(thumbnailKeyFor('docs/org-1/noext')).toBe('docs/org-1/noext-thumb.webp');
	});
});

describe('DocumentThumbnailService — happy path', () => {
	it('writes a downsized WebP through the storage provider and records thumbKey', async () => {
		providerStub.getFile.mockResolvedValue(await realPng());
		const { service, update } = buildService();
		const document = documentRow();

		const outcome = await service.generate(document, JOB);

		expect(outcome).toBe('generated');
		expect(providerStub.putFile).toHaveBeenCalledTimes(1);

		const [bytes, destination] = providerStub.putFile.mock.calls[0];
		expect(destination).toBe('docs/org-1/diagram-thumb.webp');

		// It really is a small WebP, not a copy of the source.
		const meta = await sharp(bytes).metadata();
		expect(meta.format).toBe('webp');
		expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(DOCS_THUMBNAIL_MAX_PX);

		expect(update).toHaveBeenCalledWith(
			{ id: 'doc-1', tenantId: 'tenant-1', organizationId: 'org-1' },
			{ thumbKey: 'docs/org-1/diagram-thumb.webp' }
		);
		expect(document.thumbKey).toBe('docs/org-1/diagram-thumb.webp');
	});

	it('honors a key the storage provider rewrote', async () => {
		providerStub.getFile.mockResolvedValue(await realPng());
		providerStub.putFile.mockResolvedValue({ key: 'bucket-prefix/docs/org-1/diagram-thumb.webp' });
		const { service, update } = buildService();
		const document = documentRow();

		await service.generate(document, JOB);

		expect(update).toHaveBeenCalledWith(expect.anything(), {
			thumbKey: 'bucket-prefix/docs/org-1/diagram-thumb.webp'
		});
	});

	it('renders page 1 for a PDF and resizes that', async () => {
		const pagePng = await realPng();
		providerStub.getFile.mockResolvedValue(Buffer.from('%PDF-1.7'));
		const { service, renderPages } = buildService({
			renderPages: jest.fn(async () => ({ pages: [pagePng], pageCount: 12 }))
		});

		const outcome = await service.generate(
			documentRow({ mimeType: 'application/pdf', storageKey: 'docs/org-1/report.pdf' }),
			JOB
		);

		expect(outcome).toBe('generated');
		// Exactly one page — a thumbnail never rasterizes a whole document.
		expect(renderPages).toHaveBeenCalledWith(expect.anything(), 1);
	});
});

describe('DocumentThumbnailService — the skip rules', () => {
	it('never regenerates when thumbKey is already set', async () => {
		providerStub.getFile.mockResolvedValue(await realPng());
		const { service, update } = buildService();

		const outcome = await service.generate(documentRow({ thumbKey: 'docs/org-1/diagram-thumb.webp' }), JOB);

		expect(outcome).toBe('skipped-existing');
		expect(providerStub.getFile).not.toHaveBeenCalled();
		expect(providerStub.putFile).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it('regenerates when the job asks for it (reprocess / replaced bytes)', async () => {
		providerStub.getFile.mockResolvedValue(await realPng());
		const { service } = buildService();

		const outcome = await service.generate(documentRow({ thumbKey: 'docs/org-1/diagram-thumb.webp' }), {
			...JOB,
			force: true
		});

		expect(outcome).toBe('generated');
		expect(providerStub.putFile).toHaveBeenCalledTimes(1);
	});

	it('skips formats that cannot produce one, without reading the blob', async () => {
		const { service } = buildService();

		const outcome = await service.generate(
			documentRow({ mimeType: 'text/csv', storageKey: 'docs/org-1/rows.csv' }),
			JOB
		);

		expect(outcome).toBe('skipped-unsupported');
		expect(providerStub.getFile).not.toHaveBeenCalled();
	});

	it('skips a PAGE document and a FILE with no stored blob', async () => {
		const { service } = buildService();

		expect(await service.generate(documentRow({ kind: DocumentKindEnum.PAGE }), JOB)).toBe('skipped-no-file');
		expect(await service.generate(documentRow({ storageKey: null }), JOB)).toBe('skipped-no-file');
		expect(providerStub.getFile).not.toHaveBeenCalled();
	});

	it('skips a PDF when no rasterizer is installed in this process', async () => {
		providerStub.getFile.mockResolvedValue(Buffer.from('%PDF-1.7'));
		const { service } = buildService({ renderPages: jest.fn(async () => null) });

		const outcome = await service.generate(
			documentRow({ mimeType: 'application/pdf', storageKey: 'docs/org-1/report.pdf' }),
			JOB
		);

		expect(outcome).toBe('skipped-unsupported');
		expect(providerStub.putFile).not.toHaveBeenCalled();
	});
});

describe('DocumentThumbnailService — a failure is never the document’s problem', () => {
	/** Every way the run can blow up, and the single outcome all of them produce. */
	const failures: { label: string; arrange: () => void }[] = [
		{
			label: 'the blob cannot be read',
			arrange: () => providerStub.getFile.mockRejectedValue(new Error('storage unreachable'))
		},
		{
			label: 'the bytes are not a decodable image',
			arrange: () => providerStub.getFile.mockResolvedValue(Buffer.from('not an image at all'))
		},
		{
			label: 'the thumbnail write is rejected',
			arrange: () => providerStub.putFile.mockRejectedValue(new Error('bucket is read-only'))
		}
	];

	it.each(failures)('$label → resolves "failed", never rejects', async ({ arrange }) => {
		providerStub.getFile.mockResolvedValue(await realPng());
		arrange();
		const { service, update } = buildService();
		const document = documentRow();

		await expect(service.generate(document, JOB)).resolves.toBe('failed');

		// Nothing was written, and the row keeps every status it had.
		expect(update).not.toHaveBeenCalled();
		expect(document.thumbKey).toBeNull();
		expect(document.status).toBeUndefined();
		expect(document.knowledgeStatus).toBeUndefined();
	});

	it('swallows a repository failure too — the thumbnail exists, the pointer does not', async () => {
		providerStub.getFile.mockResolvedValue(await realPng());
		const { service } = buildService({ update: jest.fn(async () => Promise.reject(new Error('db is down'))) });

		await expect(service.generate(documentRow(), JOB)).resolves.toBe('failed');
	});
});
