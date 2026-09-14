import 'reflect-metadata';

/**
 * `RepositoriesService` drags the whole entity graph in through its constructor; the export service
 * only ever calls one method on it. Stubbing the module keeps this suite about the export itself.
 */
jest.mock('../repositories/repositories.service', () => ({
	RepositoriesService: class RepositoriesService {}
}));

/**
 * The real `RequestContext` reads `nestjs-cls`, i.e. an `AsyncLocalStorage`. The stub keeps exactly
 * that property — a value that follows the async chain of ONE request — because it is the whole
 * point of the test: the tenant id was always per-request, and the file paths were not.
 */
jest.mock('../../core/context', () => ({
	RequestContext: {
		currentTenantId: () => (globalThis as any).__exportSpecRequestStore?.getStore()?.tenantId ?? null,
		currentUserId: () => (globalThis as any).__exportSpecRequestStore?.getStore()?.userId ?? null
	}
}));

import { AsyncLocalStorage } from 'node:async_hooks';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as unzipper from 'unzipper';
import { ExportRedacted } from '../export-redact.decorator';
import { ExportService, IExportJob } from './export.service';

const requestStore = new AsyncLocalStorage<{ tenantId: string }>();
(globalThis as any).__exportSpecRequestStore = requestStore;

const TENANT_A = 'a0000000-0000-4000-8000-00000000000a';
const TENANT_B = 'b0000000-0000-4000-8000-00000000000b';

/** Setting names the JSON path already treats as non-secret; mirrored by the entity's predicate. */
const NON_SECRET_NAMES = ['isEnabled', 'zone'];

/**
 * A stand-in for `IntegrationSetting`: one credential column guarded by a per-row predicate, one
 * ordinary column, and a property a subscriber attaches on load.
 */
class IntegrationSettingFixture {
	id: string;
	tenantId: string;
	settingsName: string;

	@ExportRedacted<IntegrationSettingFixture>({ when: (it) => !NON_SECRET_NAMES.includes(it.settingsName) })
	settingsValue: string;

	/** Not a persisted column — attached by the entity subscriber after load. */
	wrapSecretValue?: string;
}

const SETTING_COLUMNS = ['id', 'tenantId', 'settingsName', 'settingsValue'];

/** The rows each tenant owns, keyed by tenant id. */
const ROWS: Record<string, IntegrationSettingFixture[]> = {
	[TENANT_A]: [
		Object.assign(new IntegrationSettingFixture(), {
			id: 'row-a-token',
			tenantId: TENANT_A,
			settingsName: 'access_token',
			settingsValue: 'tenant-a-secret-access-token-0123456789',
			wrapSecretValue: 'subscriber-added'
		}),
		Object.assign(new IntegrationSettingFixture(), {
			id: 'row-a-flag',
			tenantId: TENANT_A,
			settingsName: 'isEnabled',
			settingsValue: 'true',
			wrapSecretValue: 'true'
		})
	],
	[TENANT_B]: [
		Object.assign(new IntegrationSettingFixture(), {
			id: 'row-b-token',
			tenantId: TENANT_B,
			settingsName: 'refresh_token',
			settingsValue: 'tenant-b-secret-refresh-token-9876543210',
			wrapSecretValue: 'subscriber-added'
		})
	]
};

/** Lets the two concurrent exports actually interleave on the event loop. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

/**
 * A repository just rich enough for `ExportService.getAsCsv`, returning rows for whichever tenant
 * the caller asked about and yielding to the event loop first, exactly as a real query would.
 */
function buildRepositoryGraph() {
	const repository: any = {
		metadata: {
			tableName: 'integration_setting',
			givenTableName: 'integration_setting',
			target: IntegrationSettingFixture,
			columns: SETTING_COLUMNS.map((name) => ({ propertyName: name, databaseName: name })),
			ownColumns: SETTING_COLUMNS.map((name) => ({ propertyName: name, databaseName: name })),
			manyToManyRelations: []
		},
		findAndCount: async (options: any) => {
			await tick();
			const tenantId = options?.where?.tenantId;
			// The "global default rows" probe passes an IsNull() operator, not a string.
			if (typeof tenantId !== 'string') {
				return [[], 0];
			}
			const rows = ROWS[tenantId] ?? [];
			return [rows, rows.length];
		}
	};

	return [{ repository, isCheckRelation: false, relations: [], isTenantBased: true }];
}

function buildService(): ExportService {
	const repositoriesService: any = {
		buildRepositoriesRelationsGraph: jest.fn(async () => buildRepositoryGraph())
	};
	return new ExportService(repositoriesService);
}

/** Reads one file out of a finished archive. */
async function readFromArchive(archivePath: string, fileName: string): Promise<string> {
	const directory = await unzipper.Open.file(archivePath);
	const entry = directory.files.find((file: any) => file.path === fileName);
	if (!entry) {
		throw new Error(`${fileName} is not in ${archivePath} (has: ${directory.files.map((f: any) => f.path)})`);
	}
	return (await entry.buffer()).toString('utf8');
}

/** One whole `/export` request, the way the controller drives it. */
async function runExport(service: ExportService, tenantId: string): Promise<{ job: IExportJob; archive: string }> {
	return requestStore.run({ tenantId }, async () => {
		const job = await service.createExportJob();
		await service.exportTables(job, undefined);
		await service.archiveAndDownload(job);
		return { job, archive: await readFromArchive(job.archivePath, 'integration_setting.csv') };
	});
}

describe('ExportService', () => {
	let service: ExportService;
	const jobs: IExportJob[] = [];

	beforeEach(() => {
		service = buildService();
		jobs.length = 0;
	});

	afterEach(async () => {
		for (const job of jobs) {
			await fsp.rm(job.workDir, { recursive: true, force: true }).catch(() => undefined);
		}
	});

	describe('per-request job state (GHSA-g235-c4fm-4fc7)', () => {
		it('gives every export its own scratch directory, outside the statically served tree', async () => {
			const [first, second] = await Promise.all([service.createExportJob(), service.createExportJob()]);
			jobs.push(first, second);

			expect(first.workDir).not.toBe(second.workDir);
			expect(first.csvDir).not.toBe(second.csvDir);
			expect(first.archivePath).not.toBe(second.archivePath);

			// The old scratch root was `<assetPublicPath>/export`, mounted unauthenticated at /public.
			for (const job of [first, second]) {
				expect(job.workDir.startsWith(os.tmpdir())).toBe(true);
				expect(fs.existsSync(job.csvDir)).toBe(true);
			}
		});

		it('does not let two concurrent exports cross archives', async () => {
			const [a, b] = await Promise.all([runExport(service, TENANT_A), runExport(service, TENANT_B)]);
			jobs.push(a.job, b.job);

			// Each tenant's archive holds that tenant's rows and NOTHING of the other's. With the
			// shared `idCsv`/`idZip` subjects, the second request's `createFolders()` moved the
			// directory out from under the first, which then archived its neighbour's CSVs.
			expect(a.archive).toContain('row-a-token');
			expect(a.archive).toContain('row-a-flag');
			expect(a.archive).not.toContain('row-b-token');
			expect(a.archive).not.toContain(TENANT_B);

			expect(b.archive).toContain('row-b-token');
			expect(b.archive).not.toContain('row-a-token');
			expect(b.archive).not.toContain(TENANT_A);
		});

		it('cleans one job up without touching another that is still running', async () => {
			const [first, second] = await Promise.all([service.createExportJob(), service.createExportJob()]);
			jobs.push(second);

			await fsp.writeFile(path.join(second.csvDir, 'user.csv'), 'id\n1\n');
			await service.cleanup(first);

			expect(fs.existsSync(first.workDir)).toBe(false);
			expect(fs.existsSync(path.join(second.csvDir, 'user.csv'))).toBe(true);
		});

		it('removes the archive and every CSV on cleanup, and is safe to call twice', async () => {
			const { job } = await runExport(service, TENANT_A);

			expect(fs.existsSync(job.archivePath)).toBe(true);
			expect(fs.readdirSync(job.csvDir)).toContain('integration_setting.csv');

			await service.cleanup(job);
			await service.cleanup(job);

			expect(fs.existsSync(job.workDir)).toBe(false);
		});
	});

	describe('secret redaction (GHSA-j5h5-r956-rxc3)', () => {
		it('masks a redacted column in the CSV while leaving an ordinary one intact', async () => {
			const { job, archive } = await runExport(service, TENANT_A);
			jobs.push(job);

			const [header, ...rows] = archive.trim().split(/\r?\n/);
			const tokenRow = rows.find((row) => row.startsWith('row-a-token'));
			const flagRow = rows.find((row) => row.startsWith('row-a-flag'));

			// The credential is gone …
			expect(archive).not.toContain('tenant-a-secret-access-token-0123456789');
			expect(archive).not.toContain('secret-access-token');
			expect(tokenRow).toContain('*'.repeat(35));

			// … but the column is still there, and the non-secret columns are untouched.
			expect(header.split(',')).toEqual(SETTING_COLUMNS);
			expect(tokenRow).toContain('access_token');
			expect(flagRow).toContain('isEnabled');
			expect(flagRow).toContain('true');
		});

		it('keeps subscriber-attached properties out of the archive entirely', async () => {
			const { job, archive } = await runExport(service, TENANT_A);
			jobs.push(job);

			// `wrapSecretValue` is not a persisted column; it exists only because the entity
			// subscriber attaches it on load, and it must not become a CSV column.
			expect(archive.split(/\r?\n/)[0]).not.toContain('wrapSecretValue');
			expect(archive).not.toContain('subscriber-added');
		});

		it('refuses to write a table whose entity class cannot be resolved', async () => {
			// Fail closed: an unknown entity means unknown secrets. Writing it "just in case" is how
			// the cleartext got out in the first place.
			const job = await service.createExportJob();
			jobs.push(job);

			const repository: any = {
				metadata: {
					tableName: 'mystery',
					target: undefined,
					columns: [{ propertyName: 'secret', databaseName: 'secret' }],
					manyToManyRelations: []
				},
				findAndCount: async () => [[{ secret: 'hunter2' }], 1]
			};

			await expect(
				requestStore.run({ tenantId: TENANT_A }, () =>
					service.getAsCsv(job, { repository, isCheckRelation: false, relations: [] } as any, {
						tenantId: TENANT_A
					})
				)
			).rejects.toThrow(TypeError);

			expect(fs.existsSync(path.join(job.csvDir, 'mystery.csv'))).toBe(false);
		});
	});
});
