import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

/**
 * Delete forever from the trash (`DELETE /tasks/:id/trashed`) on one SQLite database, through both ORMs.
 *
 * The trash pages called `DELETE /tasks/:id`, which deletes a live task as well: a task someone restored while the
 * page was open was deleted for good when the page's Delete forever was clicked. `TaskService.deleteTrashedTask`
 * deletes a task only while it is in the trash, and the delete statement itself decides that: one `DELETE` whose
 * WHERE carries `deletedAt IS NOT NULL`, with the task, the tenant and the organization. This suite runs the real
 * service against a database, the MikroORM branch and the TypeORM branch over the same rows, and records every
 * statement each one sends.
 *
 * The entities are the platform's own, imported under `DB_ORM=mikro-orm`; the tables are created from TypeORM's
 * mapping, and MikroORM opens them with the soft-delete extension the platform configures (whose filter applies to a
 * native delete as it does to a read). The pattern of `organization-project/testing/synced-projects.store.ts`:
 * everything is measured in `beforeAll` and asserted below.
 */

const TIMEOUT = 15 * 60 * 1000;

const IDS = {
	TENANT: '7a000000-0000-4000-8000-000000000001',
	OTHER_TENANT: '7a000000-0000-4000-8000-000000000002',
	ORGANIZATION: '7b000000-0000-4000-8000-000000000001',
	OTHER_ORGANIZATION: '7b000000-0000-4000-8000-000000000002',
	USER: '7c000000-0000-4000-8000-000000000001',
	TASK: {
		/** In the caller's trash. */
		TRASHED: '7d000000-0000-4000-8000-000000000001',
		/** Live, in the caller's organization. */
		LIVE: '7d000000-0000-4000-8000-000000000002',
		/** In the trash, then restored by someone else before Delete forever. */
		RESTORED: '7d000000-0000-4000-8000-000000000003',
		/** In the trash of another organization of the tenant. */
		OTHER_ORGANIZATION: '7d000000-0000-4000-8000-000000000004',
		/** In the trash of another tenant, under the same organization id. */
		OTHER_TENANT: '7d000000-0000-4000-8000-000000000005'
	}
} as const;

const TASKS: ReadonlyArray<{ id: string; tenantId: string; organizationId: string; deleted: boolean }> = [
	{ id: IDS.TASK.TRASHED, tenantId: IDS.TENANT, organizationId: IDS.ORGANIZATION, deleted: true },
	{ id: IDS.TASK.LIVE, tenantId: IDS.TENANT, organizationId: IDS.ORGANIZATION, deleted: false },
	{ id: IDS.TASK.RESTORED, tenantId: IDS.TENANT, organizationId: IDS.ORGANIZATION, deleted: true },
	{ id: IDS.TASK.OTHER_ORGANIZATION, tenantId: IDS.TENANT, organizationId: IDS.OTHER_ORGANIZATION, deleted: true },
	{ id: IDS.TASK.OTHER_TENANT, tenantId: IDS.OTHER_TENANT, organizationId: IDS.ORGANIZATION, deleted: true }
];

/** What one call answered, and the statements it sent. */
interface ICallOutcome {
	answer: { affected: number } | { status: number; message: string };
	statements: string[];
}

/** One ORM's run: each call, and the task ids left in the table afterwards. */
interface IOrmRun {
	trashed: ICallOutcome;
	trashedAgain: ICallOutcome;
	live: ICallOutcome;
	restored: ICallOutcome;
	otherOrganizationByOwnOrganization: ICallOutcome;
	otherOrganizationStated: ICallOutcome;
	otherTenant: ICallOutcome;
	remaining: string[];
}

type Connection = { execute(sql: string, params?: unknown[]): Promise<any> };

async function measure(): Promise<{ mikroOrm: IOrmRun; typeOrm: IOrmRun }> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';
	const file = path.join(os.tmpdir(), `gauzy-task-delete-trashed-${process.pid}-${Date.now()}.sqlite`);
	const measured = {} as { mikroOrm: IOrmRun; typeOrm: IOrmRun };

	try {
		await jest.isolateModulesAsync(async () => {
			const { MikroORM, EntityCaseNamingStrategy, MetadataStorage } = require('@mikro-orm/core');
			// MikroORM's decorator storage is global to the test file: start from the classes imported below only.
			MetadataStorage.clear();
			const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
			const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
			const { DataSource } = require('typeorm');
			const { PermissionsEnum } = require('@gauzy/contracts');
			const { coreEntities } = require('../core/entities');
			const { RequestContext } = require('../core/context');
			const { Task } = require('./task.entity');
			const { TaskService } = require('./task.service');

			const statements: string[] = [];
			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: false,
				logging: ['query'],
				logger: {
					logQuery: (query: string) => statements.push(query),
					logQueryError: () => undefined,
					logQuerySlow: () => undefined,
					logSchemaBuild: () => undefined,
					logMigration: () => undefined,
					log: () => undefined
				}
			});
			await dataSource.initialize();

			let orm: any;
			try {
				await dataSource.synchronize();
				orm = await MikroORM.init({
					driver: BetterSqliteDriver,
					dbName: file,
					entities: coreEntities,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: false,
					namingStrategy: EntityCaseNamingStrategy,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false },
					debug: ['query'],
					colors: false,
					logger: (message: string) => statements.push(message)
				});
			} catch (error) {
				await dataSource.destroy();
				throw error;
			}

			const user = { id: IDS.USER, tenantId: IDS.TENANT, lastOrganizationId: IDS.ORGANIZATION };
			const spies = [
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue(user),
				jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(IDS.TENANT),
				jest
					.spyOn(RequestContext, 'hasAnyPermission')
					.mockImplementation((wanted: string[]) => wanted.includes(PermissionsEnum.ORG_TASK_DELETE))
			];

			try {
				const service = Object.create(TaskService.prototype);
				Object.defineProperty(service, 'typeOrmRepository', { value: dataSource.getRepository(Task) });
				Object.defineProperty(service, 'mikroOrmRepository', {
					get: () => orm.em.fork().getRepository(Task)
				});
				Object.defineProperty(service, '_managedEmployeeService', {
					value: { managesAnyTeam: async () => false }
				});
				const mikroOrm = Object.create(service);
				Object.defineProperty(mikroOrm, 'ormType', { value: 'mikro-orm' });
				const typeOrm = Object.create(service);
				Object.defineProperty(typeOrm, 'ormType', { value: 'typeorm' });

				const connection: Connection = orm.em.getConnection();

				const call = async (branch: any, id: string, organizationId: string): Promise<ICallOutcome> => {
					statements.length = 0;
					let answer: ICallOutcome['answer'];
					try {
						const result = await branch.deleteTrashedTask(id, organizationId);
						answer = { affected: result.affected };
					} catch (error) {
						answer = { status: (error as any)?.getStatus?.() ?? 500, message: (error as Error).message };
					}
					return { answer, statements: [...statements] };
				};

				const run = async (branch: any): Promise<IOrmRun> => {
					await seed(connection);
					const trashed = await call(branch, IDS.TASK.TRASHED, IDS.ORGANIZATION);
					const trashedAgain = await call(branch, IDS.TASK.TRASHED, IDS.ORGANIZATION);
					const live = await call(branch, IDS.TASK.LIVE, IDS.ORGANIZATION);
					// Someone restores the task after the trash was read, before Delete forever is clicked.
					await connection.execute('UPDATE task SET deletedAt = NULL WHERE id = ?', [IDS.TASK.RESTORED]);
					const restored = await call(branch, IDS.TASK.RESTORED, IDS.ORGANIZATION);
					const otherOrganizationByOwnOrganization = await call(
						branch,
						IDS.TASK.OTHER_ORGANIZATION,
						IDS.ORGANIZATION
					);
					const otherOrganizationStated = await call(
						branch,
						IDS.TASK.OTHER_ORGANIZATION,
						IDS.OTHER_ORGANIZATION
					);
					const otherTenant = await call(branch, IDS.TASK.OTHER_TENANT, IDS.ORGANIZATION);
					const rows = await connection.execute('SELECT id FROM task ORDER BY id');
					return {
						trashed,
						trashedAgain,
						live,
						restored,
						otherOrganizationByOwnOrganization,
						otherOrganizationStated,
						otherTenant,
						remaining: rows.map((row: { id: string }) => row.id)
					};
				};

				measured.mikroOrm = await run(mikroOrm);
				measured.typeOrm = await run(typeOrm);
			} finally {
				spies.forEach((spy) => spy.mockRestore());
				await orm.close(true);
				await dataSource.destroy();
			}
		});
	} finally {
		removeFile(file);
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
	}

	return measured;
}

/** The tasks, written straight to the table (over any left by a previous run). */
async function seed(connection: Connection): Promise<void> {
	await connection.execute('PRAGMA foreign_keys = OFF');
	await connection.execute('DELETE FROM task');
	for (const task of TASKS) {
		await connection.execute(
			`INSERT INTO task (id, tenantId, organizationId, title, deletedAt)
			VALUES (?, ?, ?, ?, ${task.deleted ? "datetime('now')" : 'NULL'})`,
			[task.id, task.tenantId, task.organizationId, `task ${task.id}`]
		);
	}
}

function removeFile(file: string): void {
	for (const candidate of [file, `${file}-wal`, `${file}-shm`]) {
		try {
			fs.rmSync(candidate, { force: true });
		} catch {
			// A file still held open by a driver that failed to close is left to the OS temp sweep.
		}
	}
}

/** The statements of a call that name the task table. */
const onTask = (outcome: ICallOutcome) => outcome.statements.filter((statement) => /\btask\b/i.test(statement));

const notFound = { status: 404, message: expect.stringContaining('TASK_NOT_IN_TRASH') };

describe('TaskService.deleteTrashedTask on a database (DELETE /tasks/:id/trashed)', () => {
	let measured: { mikroOrm: IOrmRun; typeOrm: IOrmRun };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each([['MikroORM', 'mikroOrm'] as const, ['TypeORM', 'typeOrm'] as const])('on %s', (_name, orm) => {
		const run = () => measured[orm];

		it('deletes a task in the trash with one DELETE that requires it to be there, and nothing read first', () => {
			expect(run().trashed.answer).toEqual({ affected: 1 });

			const statements = onTask(run().trashed);
			expect(statements).toHaveLength(1);
			expect(statements[0]).toMatch(/^\s*(\[query\]\s*)?delete from/i);
			// MikroORM writes `deletedAt is not null`, TypeORM `NOT("deletedAt" IS NULL)`.
			expect(statements[0]).toMatch(/[`"]?deletedAt[`"]? is not null|not\s*\(\s*[`"]?deletedAt[`"]? is null\s*\)/i);
			expect(statements[0]).toMatch(/[`"]?tenantId[`"]?\s*=/i);
			expect(statements[0]).toMatch(/[`"]?organizationId[`"]?\s*=/i);
		});

		it('answers 404 for a task already deleted', () => {
			expect(run().trashedAgain.answer).toEqual(notFound);
		});

		it('answers 404 for a live task and leaves it', () => {
			expect(run().live.answer).toEqual(notFound);
			expect(run().remaining).toContain(IDS.TASK.LIVE);
		});

		it('answers 404 for a task restored after the trash was read, and leaves the restored task', () => {
			expect(run().restored.answer).toEqual(notFound);
			expect(onTask(run().restored)).toHaveLength(1);
			expect(run().remaining).toContain(IDS.TASK.RESTORED);
		});

		it('answers 404 for a trashed task of another organization, named under either organization', () => {
			expect(run().otherOrganizationByOwnOrganization.answer).toEqual(notFound);
			// Outside the caller's organization boundary: refused before any statement.
			expect(run().otherOrganizationStated.answer).toEqual(notFound);
			expect(onTask(run().otherOrganizationStated)).toEqual([]);
			expect(run().remaining).toContain(IDS.TASK.OTHER_ORGANIZATION);
		});

		it('answers 404 for a trashed task of another tenant and leaves it', () => {
			expect(run().otherTenant.answer).toEqual(notFound);
			expect(run().remaining).toContain(IDS.TASK.OTHER_TENANT);
		});

		it('removes only the task that was in the trash', () => {
			expect(run().remaining).toEqual(
				[IDS.TASK.LIVE, IDS.TASK.RESTORED, IDS.TASK.OTHER_ORGANIZATION, IDS.TASK.OTHER_TENANT].sort()
			);
		});
	});
});
