/**
 * Replacing a file writes a fresh `metadata.upload`: a picture's size goes with it, as a new upload's does, so a
 * client reserving the picture's space (the chat files list answers `width` / `height`) never reads the previous
 * file's size, nor none at all.
 */
jest.mock('@gauzy/config', () => ({ isSqlite: () => false, isBetterSqlite3: () => false }));
jest.mock('@gauzy/core', () => ({ FileStorage: class {}, RequestContext: {} }));
jest.mock('../docs.config', () => ({ getDocsConfig: () => ({}) }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('./document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('./document-quota.service', () => ({ DocumentQuotaService: class {} }));
jest.mock('./document.service', () => ({ DocumentService: class {} }));
jest.mock('./document-settings.service', () => ({ DocumentSettingsService: class {} }));

import { DocumentUploadService } from './document-upload.service';

describe('DocumentUploadService — the metadata a replace writes', () => {
	const build = () => {
		const repository = { update: jest.fn(async () => ({ affected: 1 })) };
		const service = new DocumentUploadService(repository as any, {} as any, {} as any, {} as any, {} as any);
		const document: Record<string, unknown> = {
			id: 'd1',
			tenantId: 'tenant-1',
			organizationId: 'org-1',
			version: 1,
			metadata: { upload: { declaredMimeType: 'image/png', image: { width: 10, height: 10 } }, kept: true }
		};
		const replace = (image: { width: number; height: number } | null) =>
			(service as any).persistReplacedFile(
				document,
				{ key: 'docs/tenant-1/u1/new.png', size: 3, mimetype: 'image/png' },
				'new.png',
				{ ok: true, type: { mimeType: 'image/png' } },
				'sha',
				{ name: 'local' },
				image
			);
		return { repository, document, replace };
	};

	it("records the replacement picture's size", async () => {
		const { repository, document, replace } = build();

		await replace({ width: 640, height: 480 });

		const patch = (repository.update.mock.calls[0] as unknown[])[1] as { metadata: Record<string, any> };
		expect(patch.metadata['upload']['image']).toEqual({ width: 640, height: 480 });
		expect(patch.metadata['kept']).toBe(true);
		expect((document['metadata'] as Record<string, any>)['upload']['image']).toEqual({ width: 640, height: 480 });
	});

	it("drops the previous picture's size when the replacement has none", async () => {
		const { repository, replace } = build();

		await replace(null);

		const patch = (repository.update.mock.calls[0] as unknown[])[1] as { metadata: Record<string, any> };
		expect(patch.metadata['upload']).not.toHaveProperty('image');
	});
});
