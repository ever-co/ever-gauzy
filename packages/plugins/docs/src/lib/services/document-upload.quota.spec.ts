/**
 * The organization storage quota applies to every upload, whatever `source` the client claims.
 *
 * The upload endpoint accepts `source: CHAT`, and the quota used to warn and proceed for `CHAT`, a rule meant for
 * the system's own chat and inbound-mail captures. Those write their documents without this endpoint, so the rule
 * only ever applied to clients that stated `CHAT`, and any uploader bypassed the quota by stating it.
 */
const providerStub = {
	name: 'local',
	getFile: jest.fn(async () => Buffer.from('%PDF-1.4')),
	deleteFile: jest.fn(async () => undefined)
};

jest.mock('@gauzy/core', () => ({
	FileStorage: class {
		getProvider() {
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

import { BadRequestException } from '@nestjs/common';
import { DocumentSourceEnum } from '@gauzy/contracts';
import { DOCS_QUOTA_EXCEEDED } from '../docs.constants';
import { DocumentUploadService } from './document-upload.service';

/** An organization already at its quota: any further byte exceeds it. */
function overQuotaService() {
	const documentRepository = { create: jest.fn(), save: jest.fn() };
	const settings = {
		getDefaults: jest.fn(async () => ({
			importToKnowledgeDefault: false,
			defaultVisibility: 'ORGANIZATION',
			autoClassify: false
		}))
	};
	const quota = {
		getQuotaState: jest.fn(async () => ({ quotaBytes: 100, usedBytes: 100 })),
		exceeds: jest.fn(() => true)
	};
	const service = new DocumentUploadService(
		documentRepository as any,
		{} as any,
		settings as any,
		quota as any,
		{} as any
	);

	return { service, documentRepository };
}

const upload = { key: 'documents/tenant-1/org-1/a.pdf', size: 10, originalname: 'a.pdf', mimetype: 'application/pdf' };

describe('DocumentUploadService — the storage quota is not a matter of the claimed source', () => {
	beforeEach(() => providerStub.deleteFile.mockClear());

	it.each([DocumentSourceEnum.CHAT, DocumentSourceEnum.UPLOAD, DocumentSourceEnum.EDITOR])(
		'rejects an upload over quota that claims %s, and drops the stored blob',
		async (source) => {
			const { service, documentRepository } = overQuotaService();

			const refusal = await service
				.uploadDocuments({ organizationId: 'org-1', source } as any, [{ ...upload } as any])
				.then(() => undefined)
				.catch((thrown) => thrown);

			expect(refusal).toBeInstanceOf(BadRequestException);
			expect(refusal.getResponse().rejected).toEqual([
				expect.objectContaining({ fileName: 'a.pdf', code: DOCS_QUOTA_EXCEEDED })
			]);
			expect(documentRepository.create).not.toHaveBeenCalled();
			expect(providerStub.deleteFile).toHaveBeenCalledWith(upload.key);
		}
	);
});
