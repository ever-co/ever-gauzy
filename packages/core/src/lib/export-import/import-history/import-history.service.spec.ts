import 'reflect-metadata';

/** The tenant the mocked request belongs to; `null` simulates a request that carries none. */
let mockTenantId: string | null = 'a0000000-0000-4000-8000-00000000000a';
const mockGetFile = jest.fn();
const mockFindOneByIdString = jest.fn();

jest.mock('./../../core/crud', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		findOneByIdString(...args: unknown[]) {
			return mockFindOneByIdString(...args);
		}
	}
}));
jest.mock('./../../core/context', () => ({
	RequestContext: { currentTenantId: () => mockTenantId }
}));
jest.mock('./../../core/file-storage', () => ({
	FileStorage: class FileStorage {
		getProvider() {
			return { getFile: mockGetFile };
		}
	}
}));
jest.mock('./import-history.entity', () => ({ ImportHistory: class ImportHistory {} }));
jest.mock('./repository/type-orm-import-history.repository', () => ({
	TypeOrmImportHistoryRepository: class TypeOrmImportHistoryRepository {}
}));
jest.mock('./repository/mikro-orm-import-history.repository', () => ({
	MikroOrmImportHistoryRepository: class MikroOrmImportHistoryRepository {}
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ImportHistoryService } from './import-history.service';

const TENANT = 'a0000000-0000-4000-8000-00000000000a';
const OTHER_TENANT = 'b0000000-0000-4000-8000-00000000000b';
const HISTORY_ID = 'c0000000-0000-4000-8000-00000000000c';

/**
 * The uploaded import archive is a full tenant data dump. It used to be offered at a guessable,
 * unauthenticated `/public/import/...zip` URL; it is now read back only through `getArchive()`,
 * which must never hand one tenant's archive to another.
 */
describe('ImportHistoryService.getArchive', () => {
	const service = new ImportHistoryService({} as any, {} as any);

	beforeEach(() => {
		mockTenantId = TENANT;
		mockGetFile.mockReset();
		mockFindOneByIdString.mockReset();
	});

	it('returns the archive of the own tenant, looked up with an explicit tenant condition', async () => {
		mockFindOneByIdString.mockResolvedValue({
			id: HISTORY_ID,
			tenantId: TENANT,
			file: 'tenant-dump.zip',
			path: 'import/.import-1.zip'
		});
		mockGetFile.mockResolvedValue(Buffer.from('PK'));

		const archive = await service.getArchive(HISTORY_ID);

		expect(mockFindOneByIdString).toHaveBeenCalledWith(HISTORY_ID, { where: { tenantId: TENANT } });
		expect(mockGetFile).toHaveBeenCalledWith('import/.import-1.zip');
		expect(archive).toEqual({ file: 'tenant-dump.zip', content: Buffer.from('PK') });
	});

	it('refuses a request that carries no tenant, before touching the database', async () => {
		mockTenantId = null;

		await expect(service.getArchive(HISTORY_ID)).rejects.toBeInstanceOf(ForbiddenException);
		expect(mockFindOneByIdString).not.toHaveBeenCalled();
		expect(mockGetFile).not.toHaveBeenCalled();
	});

	it('never serves the archive of another tenant, even if the lookup returned its row', async () => {
		mockFindOneByIdString.mockResolvedValue({
			id: HISTORY_ID,
			tenantId: OTHER_TENANT,
			file: 'other.zip',
			path: 'import/.import-2.zip'
		});

		await expect(service.getArchive(HISTORY_ID)).rejects.toBeInstanceOf(NotFoundException);
		expect(mockGetFile).not.toHaveBeenCalled();
	});

	it('propagates not-found for an unknown row', async () => {
		mockFindOneByIdString.mockRejectedValue(new NotFoundException());

		await expect(service.getArchive(HISTORY_ID)).rejects.toBeInstanceOf(NotFoundException);
		expect(mockGetFile).not.toHaveBeenCalled();
	});

	it('reports not-found when the archive is gone, whichever way the provider says so', async () => {
		mockFindOneByIdString.mockResolvedValue({
			id: HISTORY_ID,
			tenantId: TENANT,
			file: 'a.zip',
			path: 'import/a.zip'
		});

		// The local provider logs and resolves undefined.
		mockGetFile.mockResolvedValueOnce(undefined);
		await expect(service.getArchive(HISTORY_ID)).rejects.toBeInstanceOf(NotFoundException);

		// Cloud providers throw.
		mockGetFile.mockRejectedValueOnce(new Error('NoSuchKey'));
		await expect(service.getArchive(HISTORY_ID)).rejects.toBeInstanceOf(NotFoundException);
	});
});
