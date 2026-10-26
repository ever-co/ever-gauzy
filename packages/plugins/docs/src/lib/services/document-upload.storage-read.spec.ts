/**
 * The upload gauntlet reads the stored bytes back to sniff and hash them, whatever form the storage provider answers in.
 *
 * Every Documents upload on stage failed with `DOCS_FILE_TYPE_REJECTED` "The file could not be processed", the API
 * logging `Upload failed for logo-page1.pdf: buffer.subarray is not a function`: the service cast
 * `provider.getFile(key)` to a Buffer, but stage stores files with the DigitalOcean provider, whose `getFile` (like
 * the S3 and Wasabi providers') resolves the AWS SDK v3 body STREAM. Only the local provider resolves a Buffer. The
 * sniffer here is the real one, so a stream that slipped through would fail exactly as it did on stage.
 */
import { createHash } from 'crypto';
import { Readable } from 'stream';

const providerStub = {
	name: 'digitalocean',
	getFile: jest.fn(),
	deleteFile: jest.fn(async () => undefined)
};

jest.mock('@gauzy/core', () => ({
	// The real storage read helper (dependency-free), so the specs read what the providers really return.
	...jest.requireActual('@gauzy/core/src/lib/core/file-storage/helpers/stored-file-content'),
	FileStorage: class {
		setProvider() {
			return this;
		}
		getProvider() {
			return providerStub;
		}
		getProviderInstance() {
			return providerStub;
		}
	},
	RequestContext: {
		currentTenantId: () => 'tenant-1',
		currentOrganizationId: () => 'org-1'
	}
}));
jest.mock('../docs.config', () => ({ getDocsConfig: () => ({ maxFileSize: 1024 }) }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('./document.service', () => ({ DocumentService: class {} }));
jest.mock('./document-settings.service', () => ({ DocumentSettingsService: class {} }));
jest.mock('./document-quota.service', () => ({ DocumentQuotaService: class {} }));
jest.mock('./document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('../dto', () => ({}));

import { Logger, NotFoundException, PayloadTooLargeException, BadRequestException } from '@nestjs/common';
import { DocumentKindEnum } from '@gauzy/contracts';
import { DOCS_FILE_TOO_LARGE, DOCS_FILE_TYPE_REJECTED } from '../docs.constants';
import { DocumentUploadService } from './document-upload.service';

/** A small PDF: the sniffer only needs the `%PDF` signature and a consistent extension / declared type. */
const PDF = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

/**
 * What the S3, Wasabi and DigitalOcean providers' `getFile` resolves: the AWS SDK v3 `GetObjectCommandOutput.Body`,
 * a Node stream with the SDK's `transformTo*` methods mixed in (`sdkStreamMixin`).
 */
function sdkBody(bytes: Buffer): Readable {
	return Object.assign(Readable.from([bytes.subarray(0, 4), bytes.subarray(4)]), {
		transformToByteArray: async () => new Uint8Array(bytes),
		transformToString: async () => bytes.toString(),
		transformToWebStream: () => {
			throw new Error('not used');
		}
	});
}

const upload = {
	key: 'documents/tenant-1/org-1/0b9c.pdf',
	size: PDF.length,
	originalname: 'logo-page1.pdf',
	mimetype: 'application/pdf'
};

function buildService() {
	const queryBuilder = { select: jest.fn(), where: jest.fn(), getOne: jest.fn(async () => null) };
	const repository = { createQueryBuilder: jest.fn(() => queryBuilder) };
	const documentService = {
		applyVisibilityScope: jest.fn(),
		create: jest.fn(async (row: any) => ({ id: 'doc-1', ...row })),
		emitDocumentEvent: jest.fn()
	};
	const settings = {
		getDefaults: jest.fn(async () => ({
			importToKnowledgeDefault: false,
			defaultVisibility: 'ORGANIZATION',
			autoClassify: false
		}))
	};
	const quota = {
		getQuotaState: jest.fn(async () => ({ quotaBytes: 1_000_000, usedBytes: 0 })),
		exceeds: jest.fn(() => false)
	};
	const processing = { enqueueExtract: jest.fn(async () => undefined) };
	const service = new DocumentUploadService(
		repository as any,
		documentService as any,
		settings as any,
		quota as any,
		processing as any
	);
	return { service, documentService, processing };
}

beforeEach(() => {
	providerStub.getFile.mockReset();
	providerStub.deleteFile.mockClear();
});

describe('DocumentUploadService — upload reads the stored bytes in whatever form the provider returns', () => {
	it.each([
		['the SDK v3 body stream (S3, Wasabi, DigitalOcean — stage and prod)', () => sdkBody(PDF)],
		['a Uint8Array', () => new Uint8Array(PDF)],
		['a Buffer (local, Cloudinary)', () => Buffer.from(PDF)]
	])('accepts a PDF stored as %s, sniffed and hashed from its real bytes', async (_label, content) => {
		providerStub.getFile.mockResolvedValue(content());
		const { service, documentService, processing } = buildService();

		const response = await service.uploadDocuments({ organizationId: 'org-1' } as any, [{ ...upload } as any]);

		expect(response.rejected).toEqual([]);
		expect(response.results).toHaveLength(1);
		expect(providerStub.getFile).toHaveBeenCalledWith(upload.key);
		expect(documentService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: DocumentKindEnum.FILE,
				mimeType: 'application/pdf',
				storageKey: upload.key,
				sha256: createHash('sha256').update(PDF).digest('hex')
			})
		);
		expect(processing.enqueueExtract).toHaveBeenCalledTimes(1);
		expect(providerStub.deleteFile).not.toHaveBeenCalled();
	});

	it('rejects a file the provider cannot read back, drops the blob, and logs the storage key — not a TypeError', async () => {
		// The S3 family and the local provider log their own error and resolve undefined.
		providerStub.getFile.mockResolvedValue(undefined);
		const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		const { service, documentService } = buildService();

		const refusal = await service
			.uploadDocuments({ organizationId: 'org-1' } as any, [{ ...upload } as any])
			.then(() => undefined)
			.catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(BadRequestException);
		expect(refusal.getResponse().rejected).toEqual([
			expect.objectContaining({ fileName: 'logo-page1.pdf', code: DOCS_FILE_TYPE_REJECTED })
		]);
		expect(documentService.create).not.toHaveBeenCalled();
		expect(providerStub.deleteFile).toHaveBeenCalledWith(upload.key);
		const message = String(logged.mock.calls[0]?.[0]);
		expect(message).toContain(upload.key);
		expect(message).not.toMatch(/is not a function/);
		logged.mockRestore();
	});

	it('refuses stored bytes over the per-file limit as too large, even when the reported size was within it', async () => {
		providerStub.getFile.mockResolvedValue(sdkBody(Buffer.concat([PDF, Buffer.alloc(2048)])));
		const { service, documentService } = buildService();

		const refusal = await service
			.uploadDocuments({ organizationId: 'org-1' } as any, [{ ...upload } as any])
			.then(() => undefined)
			.catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(PayloadTooLargeException);
		expect(refusal.getResponse().rejected).toEqual([expect.objectContaining({ code: DOCS_FILE_TOO_LARGE })]);
		expect(documentService.create).not.toHaveBeenCalled();
		expect(providerStub.deleteFile).toHaveBeenCalledWith(upload.key);
	});
});

describe('DocumentUploadService — the raw byte path reads the stored bytes in whatever form the provider returns', () => {
	const fileRow = {
		id: 'doc-1',
		kind: DocumentKindEnum.FILE,
		name: 'logo-page1',
		originalFilename: 'logo-page1.pdf',
		mimeType: 'application/pdf',
		storageProvider: 'DIGITALOCEAN',
		storageKey: 'documents/tenant-1/org-1/0b9c.pdf',
		fileSize: PDF.length
	};

	function rawService() {
		const documentService = { findOneScoped: jest.fn(async () => fileRow) };
		return new DocumentUploadService({} as any, documentService as any, {} as any, {} as any, {} as any);
	}

	it('answers a Buffer (whose length is the Content-Length) for the SDK body stream', async () => {
		providerStub.getFile.mockResolvedValue(sdkBody(PDF));

		const file = await rawService().getRawFile('doc-1');

		expect(Buffer.isBuffer(file.buffer)).toBe(true);
		expect(file.buffer.length).toBe(PDF.length);
		expect(file.buffer.equals(PDF)).toBe(true);
	});

	it('404s when the provider cannot read the file back', async () => {
		providerStub.getFile.mockResolvedValue(undefined);
		const warned = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		await expect(rawService().getRawFile('doc-1')).rejects.toBeInstanceOf(NotFoundException);

		expect(String(warned.mock.calls[0]?.[0])).toContain(fileRow.storageKey);
		warned.mockRestore();
	});
});
