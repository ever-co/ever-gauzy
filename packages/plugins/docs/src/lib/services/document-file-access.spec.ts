/**
 * Regression cover for the byte-serving paths the spec mandates
 * (`03-backend-plugin.md` §4.5, `08-permissions-security.md` §5.3–§5.5).
 *
 * `GET /documents/:id/download` and `GET /documents/:id/raw` did not exist at all — file
 * preview, download, and every image embedded in a wiki page 404'd permanently, leaving the
 * unauthenticated `fileUrl` as the only working byte path. These tests pin the replacements and
 * their hardening: read scope first, FILE kind only, a validated storage key, and — above all —
 * stored `text/html` is never handed back as `text/html` from the API origin.
 */
const requestContext = { tenantId: 'tenant-1' as string | null, organizationId: 'org-1' as string | null };
const providerStub = {
	url: jest.fn(async (key: string) => `https://storage.example/${key}?signature=abc`),
	getFile: jest.fn(async () => Buffer.from('bytes'))
};

jest.mock(
	'@gauzy/core',
	() => ({
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
			currentTenantId: () => requestContext.tenantId,
			currentOrganizationId: () => requestContext.organizationId
		}
	}),
	{ virtual: true }
);
jest.mock('../docs.config', () => ({ getDocsConfig: () => ({ maxFileSize: 1024 }) }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('./document.service', () => ({ DocumentService: class {} }));
jest.mock('./document-settings.service', () => ({ DocumentSettingsService: class {} }));
jest.mock('./document-quota.service', () => ({ DocumentQuotaService: class {} }));
jest.mock('./document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('../dto', () => ({}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentKindEnum } from '@gauzy/contracts';
import { DOCS_NOT_A_FILE } from '../docs.constants';
import { DocumentUploadService } from './document-upload.service';

/** A FILE document row stub carrying only the fields the byte paths read. */
const fileRow = (overrides: Record<string, any> = {}): any => ({
	id: 'doc-1',
	kind: DocumentKindEnum.FILE,
	name: 'report',
	originalFilename: 'report.pdf',
	mimeType: 'application/pdf',
	storageProvider: 'LOCAL',
	storageKey: 'documents/tenant-1/org-1/1a2b3c.pdf',
	...overrides
});

const buildService = (document: any, options: { notFound?: boolean } = {}) => {
	const documentService: any = {
		findOneScoped: jest.fn(async () => {
			if (options.notFound) {
				throw new NotFoundException('Document was not found');
			}
			return document;
		})
	};
	const service = new DocumentUploadService({} as any, documentService, {} as any, {} as any, {} as any);
	return { service, documentService };
};

beforeEach(() => {
	providerStub.url.mockClear();
	providerStub.getFile.mockClear();
});

describe('DocumentUploadService — download URL', () => {
	it('resolves the provider URL for a FILE document in scope', async () => {
		const { service } = buildService(fileRow());

		await expect(service.getDownloadUrl('doc-1')).resolves.toEqual({
			url: 'https://storage.example/documents/tenant-1/org-1/1a2b3c.pdf?signature=abc'
		});
		expect(providerStub.url).toHaveBeenCalledWith('documents/tenant-1/org-1/1a2b3c.pdf');
	});

	it('resolves the document through the read scope before touching storage', async () => {
		const { service, documentService } = buildService(fileRow(), { notFound: true });

		await expect(service.getDownloadUrl('doc-1')).rejects.toBeInstanceOf(NotFoundException);
		expect(documentService.findOneScoped).toHaveBeenCalledWith('doc-1');
		expect(providerStub.url).not.toHaveBeenCalled();
	});

	it('409s a PAGE or FOLDER — only FILE documents carry stored bytes', async () => {
		const { service } = buildService(fileRow({ kind: DocumentKindEnum.PAGE }));

		await expect(service.getDownloadUrl('doc-1')).rejects.toBeInstanceOf(ConflictException);
		await expect(service.getDownloadUrl('doc-1')).rejects.toMatchObject({
			response: { code: DOCS_NOT_A_FILE }
		});
	});

	it.each([
		['a traversal segment', 'documents/tenant-1/org-1/../../../etc/passwd'],
		['a Windows traversal segment', 'documents\\tenant-1\\..\\..\\secrets.env'],
		['an absolute posix path', '/etc/passwd'],
		['a drive letter', 'C:/Windows/win.ini']
	])('refuses to hand %s to the storage provider', async (_label: string, storageKey: string) => {
		const { service } = buildService(fileRow({ storageKey }));

		await expect(service.getDownloadUrl('doc-1')).rejects.toBeInstanceOf(NotFoundException);
		expect(providerStub.url).not.toHaveBeenCalled();
	});

	it('accepts the provider-native key shapes (Windows separators, capture prefixes)', async () => {
		for (const storageKey of [
			'documents\\tenant-1\\org-1\\1a2b3c.pdf',
			'documents/tenant-1/org-1/capture/1a2b3c.pdf',
			'organizations/acme/handbook.pdf'
		]) {
			const { service } = buildService(fileRow({ storageKey }));

			await expect(service.getDownloadUrl('doc-1')).resolves.toBeDefined();
		}
	});
});

describe('DocumentUploadService — raw stream hardening', () => {
	it('serves an inline-safe type inline with its stored content type', async () => {
		const { service } = buildService(fileRow({ mimeType: 'image/png', originalFilename: 'chart.png' }));

		await expect(service.getRawFile('doc-1')).resolves.toMatchObject({
			contentType: 'image/png',
			disposition: 'inline',
			fileName: 'chart.png'
		});
	});

	it('NEVER serves stored text/html as text/html (same-origin stored XSS)', async () => {
		const { service } = buildService(
			fileRow({
				mimeType: 'text/html',
				originalFilename: 'payload.html',
				storageKey: 'documents/tenant-1/org-1/x.bin'
			})
		);

		const file = await service.getRawFile('doc-1');

		expect(file.contentType).toBe('application/octet-stream');
		expect(file.disposition).toBe('attachment');
	});

	it('downgrades every non-inline-safe type to an octet-stream attachment', async () => {
		for (const mimeType of [
			'text/csv',
			'text/plain',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
		]) {
			const { service } = buildService(fileRow({ mimeType }));
			const file = await service.getRawFile('doc-1');

			expect(file.contentType).toBe('application/octet-stream');
			expect(file.disposition).toBe('attachment');
		}
	});

	it('strips header-injection characters out of the download filename', async () => {
		const { service } = buildService(fileRow({ originalFilename: 'evil"\r\nX-Injected: 1;.pdf' }));

		const file = await service.getRawFile('doc-1');

		expect(file.fileName).not.toMatch(/[\r\n";]/);
		expect(file.fileName).toBe('evilX-Injected: 1.pdf');
	});

	it('404s a FILE row that has no stored blob', async () => {
		const { service } = buildService(fileRow({ storageKey: null }));

		await expect(service.getRawFile('doc-1')).rejects.toBeInstanceOf(NotFoundException);
	});
});
