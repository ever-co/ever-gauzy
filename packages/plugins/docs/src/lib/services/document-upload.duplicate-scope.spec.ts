/**
 * An upload reports a twin (`duplicateOfId`, the document with the same bytes) only when the uploader may read it.
 *
 * The lookup used to search every FILE of the organization, so uploading a known file answered with the id of
 * another member's PRIVATE copy: proof that someone in the organization keeps it. It now runs under the documents'
 * read rule (visibility, ownership, `DOCS_MANAGE`, shares), the predicate every list uses.
 */
jest.mock('@gauzy/core', () => ({
	FileStorage: class {},
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

import { DocumentKindEnum } from '@gauzy/contracts';
import { DocumentUploadService } from './document-upload.service';

function build(twin: { id: string } | null) {
	const calls: string[] = [];
	const qb: any = {
		select: jest.fn(() => (calls.push('select'), qb)),
		where: jest.fn(() => (calls.push('where'), qb)),
		andWhere: jest.fn(() => (calls.push('andWhere'), qb)),
		getOne: jest.fn(async () => (calls.push('getOne'), twin))
	};
	const repository = { createQueryBuilder: jest.fn(() => qb), findOne: jest.fn() };
	const documentService = {
		applyVisibilityScope: jest.fn(() => {
			calls.push('visibility');
		})
	};
	const service = new DocumentUploadService(
		repository as any,
		documentService as any,
		{} as any,
		{} as any,
		{} as any
	);
	return { service, repository, documentService, qb, calls };
}

const context = { tenantId: 'tenant-1', organizationId: 'org-1' };

describe('DocumentUploadService — an upload reports only a twin the uploader may read', () => {
	it('looks the twin up under the read rule, in the batch organization, before reading it', async () => {
		const { service, repository, documentService, qb, calls } = build({ id: 'twin-1' });

		const twin = await (service as any).findDuplicate('abc123', context);

		expect(twin).toEqual({ id: 'twin-1' });
		expect(qb.where).toHaveBeenCalledWith({
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			kind: DocumentKindEnum.FILE,
			sha256: 'abc123'
		});
		expect(documentService.applyVisibilityScope).toHaveBeenCalledWith(qb);
		expect(calls.indexOf('visibility')).toBeLessThan(calls.indexOf('getOne'));
		// The unscoped lookup is gone.
		expect(repository.findOne).not.toHaveBeenCalled();
	});

	it('reports no twin when the only copy is one the uploader may not read', async () => {
		const { service } = build(null);

		await expect((service as any).findDuplicate('abc123', context)).resolves.toBeNull();
	});
});
