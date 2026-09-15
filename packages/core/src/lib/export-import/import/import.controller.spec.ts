import 'reflect-metadata';

jest.mock('../../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {}
}));
jest.mock('../../shared/decorators', () => ({ Permissions: () => () => undefined }));
jest.mock('../../core/context', () => ({
	RequestContext: { currentTenantId: () => 'a0000000-0000-4000-8000-00000000000a' }
}));
jest.mock('../../core/file-storage', () => ({
	archiveUploadFileFilter: jest.fn(),
	UploadedFileStorage: () => () => undefined,
	FileStorage: class FileStorage {
		storage() {
			return {};
		}
	}
}));
jest.mock('../import-history', () => ({
	ImportHistoryCreateCommand: class ImportHistoryCreateCommand {
		constructor(public readonly input: any) {}
	}
}));
jest.mock('./import.service', () => ({ ImportService: class ImportService {} }));

import { ImportStatusEnum, ImportTypeEnum } from '@gauzy/contracts';
import { ImportController } from './import.controller';

const EXTRACT_PATH = '/tmp/gauzy-import-abc123';
const KEY = 'import/import-1757000000-123.zip';

/**
 * The extracted CSVs are a full tenant data dump, and until this fix they were written into a
 * directory `ServeStaticModule` publishes unauthenticated at `/public/import/csv/`. The cleanup sat
 * inside the `try`, after the calls that throw, so ANY failed import left that dump downloadable
 * forever (GHSA-g235-c4fm-4fc7).
 */
describe('ImportController', () => {
	const buildService = () => ({
		createExtractDirectory: jest.fn(async () => EXTRACT_PATH),
		unzipAndParse: jest.fn(async () => undefined),
		addCurrentUserToImportedOrganizations: jest.fn(async () => undefined),
		removeExtractedFiles: jest.fn(async () => undefined),
		removeUploadedArchive: jest.fn(async () => undefined)
	});

	const file = { key: KEY, originalname: 'archive.zip', size: 2048 } as any;

	it('imports, then removes the extracted files and the uploaded archive', async () => {
		const service = buildService();
		const commandBus = { execute: jest.fn(async (command: any) => command.input) };
		const controller = new ImportController(service as any, commandBus as any);

		const history = await controller.parse({ importType: ImportTypeEnum.MERGE }, file);

		expect(service.unzipAndParse).toHaveBeenCalledWith(EXTRACT_PATH, KEY, false);
		expect(service.addCurrentUserToImportedOrganizations).toHaveBeenCalledWith(EXTRACT_PATH);
		expect(service.removeExtractedFiles).toHaveBeenCalledWith(EXTRACT_PATH);
		expect(service.removeUploadedArchive).toHaveBeenCalledWith(KEY);
		expect(history.status).toBe(ImportStatusEnum.SUCCESS);
	});

	it('still removes the extracted files when the import throws', async () => {
		const service = buildService();
		service.unzipAndParse = jest.fn(async () => {
			throw new Error('malformed archive');
		});
		const commandBus = { execute: jest.fn(async (command: any) => command.input) };
		const controller = new ImportController(service as any, commandBus as any);

		const history = await controller.parse({ importType: ImportTypeEnum.CLEAN }, file);

		expect(history.status).toBe(ImportStatusEnum.FAILED);
		expect(service.removeExtractedFiles).toHaveBeenCalledWith(EXTRACT_PATH);
		expect(service.removeUploadedArchive).toHaveBeenCalledWith(KEY);
	});

	it('still removes the extracted files when adding the user to the organizations throws', async () => {
		const service = buildService();
		service.addCurrentUserToImportedOrganizations = jest.fn(async () => {
			throw new Error('organization.csv is missing');
		});
		const commandBus = { execute: jest.fn(async (command: any) => command.input) };
		const controller = new ImportController(service as any, commandBus as any);

		const history = await controller.parse({ importType: ImportTypeEnum.MERGE }, file);

		expect(history.status).toBe(ImportStatusEnum.FAILED);
		expect(service.removeExtractedFiles).toHaveBeenCalledWith(EXTRACT_PATH);
	});

	it('records a FAILED history and removes the upload even if no directory was ever created', async () => {
		const service = buildService();
		service.createExtractDirectory = jest.fn(async () => {
			throw new Error('read-only file system');
		});
		const commandBus = { execute: jest.fn(async (command: any) => command.input) };
		const controller = new ImportController(service as any, commandBus as any);

		const history = await controller.parse({ importType: ImportTypeEnum.MERGE }, file);

		expect(history.status).toBe(ImportStatusEnum.FAILED);
		expect(service.removeExtractedFiles).toHaveBeenCalledWith(undefined);
		expect(service.removeUploadedArchive).toHaveBeenCalledWith(KEY);
	});

	it('gives concurrent imports their own extraction directories', async () => {
		const service = buildService();
		let counter = 0;
		service.createExtractDirectory = jest.fn(async () => `/tmp/gauzy-import-${++counter}`);
		service.unzipAndParse = jest.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 5));
		});
		const commandBus = { execute: jest.fn(async (command: any) => command.input) };
		const controller = new ImportController(service as any, commandBus as any);

		await Promise.all([
			controller.parse({ importType: ImportTypeEnum.MERGE }, { ...file, key: 'import/a.zip' }),
			controller.parse({ importType: ImportTypeEnum.MERGE }, { ...file, key: 'import/b.zip' })
		]);

		const extracted = service.unzipAndParse.mock.calls.map((call: any[]) => call[0]);
		expect(new Set(extracted).size).toBe(2);

		// Each request removes its OWN directory — the shared field used to make one request's
		// cleanup delete the other's in-progress extraction.
		const removed = service.removeExtractedFiles.mock.calls.map((call: any[]) => call[0]).sort();
		expect(removed).toEqual([...extracted].sort());
	});
});
