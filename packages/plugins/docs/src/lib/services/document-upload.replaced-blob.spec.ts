/**
 * A duplicated FILE re-uses its source's storage key, and replacing a file deleted the superseded key
 * unconditionally once the swap was committed. Anyone who could read a file could therefore duplicate it,
 * replace the file on their copy, and delete the original's bytes — the original document then pointed at
 * nothing. The superseded blob is now deleted only when no other document (trashed ones included) uses it.
 */
const deleteFile = jest.fn(async () => undefined);
jest.mock('@gauzy/config', () => ({ isSqlite: () => false, isBetterSqlite3: () => false }));
jest.mock('@gauzy/core', () => ({
	FileStorage: class {
		getProvider() {
			return { deleteFile };
		}
	},
	RequestContext: {}
}));
jest.mock('../docs.config', () => ({ getDocsConfig: () => ({}) }));
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('./document-processing.service', () => ({ DocumentProcessingService: class {} }));
jest.mock('./document-quota.service', () => ({ DocumentQuotaService: class {} }));
jest.mock('./document.service', () => ({ DocumentService: class {} }));
jest.mock('./document-settings.service', () => ({ DocumentSettingsService: class {} }));

import { DocumentUploadService } from './document-upload.service';

describe('DocumentUploadService — the blob a replace supersedes', () => {
	const ORIGINAL_KEY = 'docs/tenant-1/carol/contract.pdf';

	/** The table after the swap: `others` rows still carry the superseded key. */
	const build = (others: number) => {
		const repository = { count: jest.fn(async () => others) };
		const service = new DocumentUploadService(repository as any, {} as any, {} as any, {} as any, {} as any);
		const release = (key: string | null) =>
			(service as any).releaseReplacedBlob(key, 'LOCAL', 'docs/tenant-1/bob/new.pdf');
		return { repository, release };
	};

	beforeEach(() => deleteFile.mockClear());

	it('keeps it while another document — the original a copy was made from — still uses it', async () => {
		const { repository, release } = build(1);

		await release(ORIGINAL_KEY);

		expect(repository.count).toHaveBeenCalledWith({ where: { storageKey: ORIGINAL_KEY }, withDeleted: true });
		expect(deleteFile).not.toHaveBeenCalled();
	});

	it('deletes it once no document uses it (control)', async () => {
		const { release } = build(0);

		await release(ORIGINAL_KEY);

		expect(deleteFile).toHaveBeenCalledWith(ORIGINAL_KEY);
	});

	it('does nothing without a superseded key, or when the key did not change', async () => {
		const { repository } = build(0);
		const service = new DocumentUploadService(repository as any, {} as any, {} as any, {} as any, {} as any);

		await (service as any).releaseReplacedBlob(null, 'LOCAL', 'docs/new.pdf');
		await (service as any).releaseReplacedBlob('docs/same.pdf', 'LOCAL', 'docs/same.pdf');

		expect(repository.count).not.toHaveBeenCalled();
		expect(deleteFile).not.toHaveBeenCalled();
	});

	it('keeps it, without failing the committed replace, when the reference check fails', async () => {
		const repository = { count: jest.fn(async () => Promise.reject(new Error('connection lost'))) };
		const service = new DocumentUploadService(repository as any, {} as any, {} as any, {} as any, {} as any);

		await expect(
			(service as any).releaseReplacedBlob(ORIGINAL_KEY, 'LOCAL', 'docs/tenant-1/bob/new.pdf')
		).resolves.toBeUndefined();
		expect(deleteFile).not.toHaveBeenCalled();
	});
});
