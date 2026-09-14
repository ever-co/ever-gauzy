import 'reflect-metadata';

jest.mock('../../shared/guards', () => ({
	PermissionGuard: class PermissionGuard {},
	TenantPermissionGuard: class TenantPermissionGuard {}
}));
jest.mock('../../shared/decorators', () => ({ Permissions: () => () => undefined }));
jest.mock('../../shared/pipes/parse-json.pipe', () => ({ ParseJsonPipe: class ParseJsonPipe {} }));
jest.mock('./export.service', () => ({ ExportService: class ExportService {} }));

import { ExportController } from './export.controller';

/**
 * The scratch directory must go away whatever happens to the request.
 *
 * Before the fix the delete steps were the LAST two statements of each handler, so any throw in
 * between — a failing query, a disk error, a client that hung up — left the plaintext CSVs and the
 * ZIP sitting on the API's disk, under the directory `ServeStaticModule` publishes at `/public/`.
 */
describe('ExportController', () => {
	const buildService = () => ({
		createExportJob: jest.fn(async () => ({
			id: 'job-1',
			workDir: '/tmp/gauzy-export-1',
			csvDir: '/tmp/gauzy-export-1/csv',
			archivePath: '/tmp/gauzy-export-1/job-1_export.zip',
			archiveName: 'job-1_export.zip'
		})),
		exportTables: jest.fn(async () => true),
		exportSpecificTables: jest.fn(async () => true),
		exportSpecificTablesSchema: jest.fn(async () => true),
		archiveAndDownload: jest.fn(async () => undefined),
		downloadToUser: jest.fn(async () => undefined),
		cleanup: jest.fn(async () => undefined)
	});

	const res = {} as any;

	it.each([
		['exportAll', (controller: ExportController, s: any) => controller.exportAll({}, 'org-1', res), 'exportTables'],
		[
			'downloadTemplate',
			(controller: ExportController) => controller.downloadTemplate(res),
			'exportSpecificTablesSchema'
		],
		[
			'exportByName',
			(controller: ExportController) => controller.exportByName({ entities: { names: ['user'] } }, {}, res),
			'exportSpecificTables'
		]
	])('%s cleans up after a successful export', async (_name, invoke) => {
		const service = buildService();
		const controller = new ExportController(service as any);

		await invoke(controller, service);

		expect(service.cleanup).toHaveBeenCalledTimes(1);
		expect(service.cleanup).toHaveBeenCalledWith(await service.createExportJob.mock.results[0].value);
	});

	it.each([
		['exportAll', (controller: ExportController) => controller.exportAll({}, 'org-1', res), 'exportTables'],
		[
			'downloadTemplate',
			(controller: ExportController) => controller.downloadTemplate(res),
			'exportSpecificTablesSchema'
		],
		[
			'exportByName',
			(controller: ExportController) => controller.exportByName({ entities: { names: ['user'] } }, {}, res),
			'exportSpecificTables'
		]
	])('%s still cleans up when the export throws', async (_name, invoke, failing) => {
		const service = buildService();
		service[failing as keyof typeof service] = jest.fn(async () => {
			throw new Error('query failed half-way through the export');
		}) as any;
		const controller = new ExportController(service as any);

		await expect(invoke(controller)).rejects.toThrow('query failed half-way through the export');

		expect(service.cleanup).toHaveBeenCalledTimes(1);
		// The archive was never produced, so nothing was streamed — but the scratch dir still goes.
		expect(service.downloadToUser).not.toHaveBeenCalled();
	});

	it('cleans up when the download itself fails', async () => {
		const service = buildService();
		service.downloadToUser = jest.fn(async () => {
			throw new Error('socket closed');
		});
		const controller = new ExportController(service as any);

		await expect(controller.exportAll({}, 'org-1', res)).rejects.toThrow('socket closed');
		expect(service.cleanup).toHaveBeenCalledTimes(1);
	});

	it('passes each request its own job, never a shared one', async () => {
		const service = buildService();
		let counter = 0;
		service.createExportJob = jest.fn(async () => {
			const id = `job-${++counter}`;
			return {
				id,
				workDir: `/tmp/gauzy-export-${id}`,
				csvDir: `/tmp/gauzy-export-${id}/csv`,
				archivePath: `/tmp/gauzy-export-${id}/${id}_export.zip`,
				archiveName: `${id}_export.zip`
			};
		});
		const controller = new ExportController(service as any);

		await Promise.all([controller.exportAll({}, 'org-1', res), controller.exportAll({}, 'org-2', res)]);

		const jobs = service.exportTables.mock.calls.map((call: any[]) => call[0]);
		expect(jobs).toHaveLength(2);
		expect(jobs[0].workDir).not.toBe(jobs[1].workDir);

		// Every later step of a request sees that request's own job.
		for (const method of ['archiveAndDownload', 'downloadToUser', 'cleanup'] as const) {
			const seen = (service[method] as jest.Mock).mock.calls.map((call: any[]) => call[0].workDir).sort();
			expect(seen).toEqual(jobs.map((job: any) => job.workDir).sort());
		}
	});
});
