import 'reflect-metadata';

jest.mock('./../../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {}
}));
jest.mock('./import-history.service', () => ({ ImportHistoryService: class ImportHistoryService {} }));

import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { ImportHistoryController } from './import-history.controller';

const HISTORY_ID = 'c0000000-0000-4000-8000-00000000000c';

/**
 * `GET /import/history/:id/download` serves a full tenant data dump, so it has to sit behind the same
 * guards and permissions as the history list — `PermissionGuard` authorizes any route that carries no
 * `@Permissions` metadata at all.
 */
describe('ImportHistoryController', () => {
	it('guards the download route with the tenant and permission guards and the import permissions', () => {
		expect(Reflect.getMetadata(GUARDS_METADATA, ImportHistoryController)).toEqual([
			TenantPermissionGuard,
			PermissionGuard
		]);

		// The handler declares none of its own, so the class-level list is the one `PermissionGuard` reads.
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ImportHistoryController.prototype.download)).toBeUndefined();
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, ImportHistoryController)).toEqual([
			PermissionsEnum.ALL_ORG_VIEW,
			PermissionsEnum.IMPORT_ADD
		]);

		expect(Reflect.getMetadata(PATH_METADATA, ImportHistoryController.prototype.download)).toBe(':id/download');
	});

	it('sends the archive as a ZIP attachment under its original name', async () => {
		const content = Buffer.from('PK');
		const service = { getArchive: jest.fn(async () => ({ file: 'tenant dump.zip', content })) };
		const res = { setHeader: jest.fn(), attachment: jest.fn(), send: jest.fn() };
		const controller = new ImportHistoryController(service as any);

		await controller.download(HISTORY_ID, res as any);

		expect(service.getArchive).toHaveBeenCalledWith(HISTORY_ID);
		expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
		expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
		expect(res.attachment).toHaveBeenCalledWith('tenant dump.zip');
		expect(res.send).toHaveBeenCalledWith(content);
	});

	it('writes nothing when the archive cannot be served', async () => {
		const service = {
			getArchive: jest.fn(async () => {
				throw new Error('not found');
			})
		};
		const res = { setHeader: jest.fn(), attachment: jest.fn(), send: jest.fn() };
		const controller = new ImportHistoryController(service as any);

		await expect(controller.download(HISTORY_ID, res as any)).rejects.toThrow('not found');
		expect(res.send).not.toHaveBeenCalled();
	});
});
