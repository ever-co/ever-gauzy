import 'reflect-metadata';

jest.mock('../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {}
}));
jest.mock('../shared/pipes/parse-json.pipe', () => ({ ParseJsonPipe: class ParseJsonPipe {} }));
jest.mock('../shared/pipes', () => ({ UUIDValidationPipe: class UUIDValidationPipe {} }));
jest.mock('./export/export.service', () => ({ ExportService: class ExportService {} }));
jest.mock('./import/import.service', () => ({ ImportService: class ImportService {} }));
jest.mock('./import-history/import-history.service', () => ({ ImportHistoryService: class ImportHistoryService {} }));
jest.mock('../core/context', () => ({ RequestContext: {} }));
jest.mock('../core/file-storage', () => ({
	archiveUploadFileFilter: jest.fn(),
	UploadedFileStorage: () => () => undefined,
	FileStorage: class FileStorage {
		storage() {
			return {};
		}
	}
}));
jest.mock('./import-history', () => ({ ImportHistoryCreateCommand: class ImportHistoryCreateCommand {} }));

import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { PermissionsEnum } from '@gauzy/contracts';
import { ExportController } from './export/export.controller';
import { ImportController } from './import/import.controller';
import { ImportHistoryController } from './import-history/import-history.controller';

/**
 * An export, an import archive and an import are each a whole tenant's tables, so each is granted by its own
 * capability alone. `@Permissions` is any-of, and the routes used to list `ALL_ORG_VIEW` (export, import history)
 * or `ALL_ORG_EDIT` (import) beside it, which let an organization-wide view or edit grant dump or overwrite the
 * tenant.
 */
describe('import and export grants', () => {
	it.each([
		['the export', ExportController, [PermissionsEnum.EXPORT_ADD]],
		['the import', ImportController, [PermissionsEnum.IMPORT_ADD]],
		['the import history and its archives', ImportHistoryController, [PermissionsEnum.IMPORT_ADD]]
	])('grants %s by its own capability alone', (_name, controller, permissions) => {
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller)).toEqual(permissions);
	});

	it.each([ExportController, ImportController, ImportHistoryController])(
		'states no permission on a handler of %p that would replace the class-level one',
		(controller) => {
			for (const name of Object.getOwnPropertyNames(controller.prototype)) {
				if (name === 'constructor') continue;
				expect(Reflect.getMetadata(PERMISSIONS_METADATA, controller.prototype[name])).toBeUndefined();
			}
		}
	);
});
