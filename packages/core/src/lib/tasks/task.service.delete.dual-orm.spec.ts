import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { MikroORM as MikroOrmInstance } from '@mikro-orm/core';

/**
 * The hard delete of a task (`DELETE /tasks/:id`, `TaskService.deleteTask`) on one SQLite database, through both ORMs.
 *
 * The route deletes a task for good whether it is live or in the trash. Two things went wrong on it:
 * - MikroORM applies its soft-delete filter (`deletedAt IS NULL`) to a native delete as it does to a read, so on
 *   MikroORM a task in the trash was never deleted: the statement matched no row and the route answered 200.
 * - A task that other rows still point at through a foreign key with no delete rule of its own (a linked issue, a key
 *   result) is refused by the database, and the route answered that refusal with a 404, as if the task did not exist.
 *
 * This suite runs the real service against a database, the MikroORM branch and the TypeORM branch over the same rows,
 * and records every statement each one sends. The setup is `task.service.delete-trashed.dual-orm.spec.ts`'s: the
 * platform's own entities under `DB_ORM=mikro-orm`, tables from TypeORM's mapping, MikroORM opened with the
 * soft-delete extension the platform configures, rows written with foreign keys off and every call run with them
 * enforced. Everything is measured in `beforeAll` and asserted below.
 */

const TIMEOUT = 15 * 60 * 1000;

const IDS = {
	TENANT: '6a000000-0000-4000-8000-000000000001',
	OTHER_TENANT: '6a000000-0000-4000-8000-000000000002',
	ORGANIZATION: '6b000000-0000-4000-8000-000000000001',
	OTHER_ORGANIZATION: '6b000000-0000-4000-8000-000000000002',
	USER: '6c000000-0000-4000-8000-000000000001',
	TASK: {
		/** In the caller's trash. */
		TRASHED: '6d000000-0000-4000-8000-000000000001',
		/** Live, in the caller's organization. */
		LIVE: '6d000000-0000-4000-8000-000000000002',
		/** Live, still linked to another task and named by a key result. */
		REFERENCED_LIVE: '6d000000-0000-4000-8000-000000000003',
		/** In the trash, still linked from another task and named by a key result. */
		REFERENCED_TRASHED: '6d000000-0000-4000-8000-000000000004',
		/** Live, in another organization of the tenant (outside the caller's organization boundary). */
		OTHER_ORGANIZATION: '6d000000-0000-4000-8000-000000000005',
		/** In the trash of another tenant, under the same organization id. */
		OTHER_TENANT: '6d000000-0000-4000-8000-000000000006',
		/** No such task. */
		MISSING: '6d000000-0000-4000-8000-000000000007'
	},
	LINKED_ISSUE: '6e000000-0000-4000-8000-000000000001',
	KEY_RESULT: {
		LIVE: '6f000000-0000-4000-8000-000000000001',
		TRASHED: '6f000000-0000-4000-8000-000000000002'
	}
} as const;

const TASKS: ReadonlyArray<{ id: string; tenantId: string; organizationId: string; deleted: boolean }> = [
	{ id: IDS.TASK.TRASHED, tenantId: IDS.TENANT, organizationId: IDS.ORGANIZATION, deleted: true },
	{ id: IDS.TASK.LIVE, tenantId: IDS.TENANT, organizationId: IDS.ORGANIZATION, deleted: false },
	{ id: IDS.TASK.REFERENCED_LIVE, tenantId: IDS.TENANT, organizationId: IDS.ORGANIZATION, deleted: false },
	{ id: IDS.TASK.REFERENCED_TRASHED, tenantId: IDS.TENANT, organizationId: IDS.ORGANIZATION, deleted: true },
	{ id: IDS.TASK.OTHER_ORGANIZATION, tenantId: IDS.TENANT, organizationId: IDS.OTHER_ORGANIZATION, deleted: false },
	{ id: IDS.TASK.OTHER_TENANT, tenantId: IDS.OTHER_TENANT, organizationId: IDS.ORGANIZATION, deleted: true }
];

/** What one call answered, the statements it sent, and the task events it published. */
interface ICallOutcome {
	answer: { affected: number } | { status: number; message: string };
	statements: string[];
	events: string[];
}

/** One ORM's run: each call, and what is left in the tables afterwards. */
interface IOrmRun {
	trashed: ICallOutcome;
	live: ICallOutcome;
	referencedLive: ICallOutcome;
	referencedTrashed: ICallOutcome;
	otherOrganization: ICallOutcome;
	otherTenant: ICallOutcome;
	missing: ICallOutcome;
	remaining: string[];
	/** The linked issue and the key results left pointing at the referenced tasks. */
	references: { linkedIssues: number; keyResults: number };
	/** `PRAGMA foreign_keys` on each connection while the calls ran. */
	foreignKeys: { mikroOrm: number; typeOrm: number };
}

type Connection = { execute(sql: string, params?: unknown[]): Promise<unknown> };

/** One ORM's branch of the service, as this suite calls it. */
interface IDeleteBranch {
	deleteTask(id: string): Promise<{ affected?: number | null }>;
}

async function measure(): Promise<{ mikroOrm: IOrmRun; typeOrm: IOrmRun }> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';
	const file = path.join(os.tmpdir(), `gauzy-task-delete-${process.pid}-${Date.now()}.sqlite`);
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
			// Enforced on the connection TypeORM deletes through, as on a real database.
			await dataSource.query('PRAGMA foreign_keys = ON');

			let orm: MikroOrmInstance;
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
				// An organization member (not a tenant admin): kept inside the selected organization.
				jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(IDS.ORGANIZATION),
				jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false),
				jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null),
				jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false),
				jest
					.spyOn(RequestContext, 'hasAnyPermission')
					.mockImplementation((wanted: string[]) => wanted.includes(PermissionsEnum.ORG_TASK_DELETE))
			];
			// The console.error of a refused delete is expected here; anything else still shows.
			const quiet = jest.spyOn(console, 'error').mockImplementation(() => undefined);

			try {
				const events: string[] = [];
				const service = Object.create(TaskService.prototype);
				Object.defineProperty(service, 'typeOrmRepository', { value: dataSource.getRepository(Task) });
				Object.defineProperty(service, 'mikroOrmRepository', {
					get: () => orm.em.fork().getRepository(Task)
				});
				Object.defineProperty(service, '_managedEmployeeService', {
					value: { managesAnyTeam: async () => false }
				});
				Object.defineProperty(service, '_domainEventBus', {
					value: {
						publish: async (event: { entity?: { id?: string }; type?: string }) =>
							events.push(`${event.type}:${event.entity?.id}`)
					}
				});
				// The delete runs through the tenant-aware CRUD service, whose instance fields a constructor would set.
				const branch = (ormType: string) => {
					const instance = Object.create(service);
					Object.defineProperty(instance, 'ormType', { value: ormType });
					Object.defineProperty(instance, 'mikroOrmScopeColumns', { value: new Map() });
					Object.defineProperty(instance, 'readScopePredicates', { value: new Map() });
					Object.defineProperty(instance, 'skipEmployeeFilterKey', {
						value: `skipEmployeeFilter:spec:${ormType}`
					});
					Object.defineProperty(instance, 'skipOrganizationBoundaryKey', {
						value: `skipOrganizationBoundary:spec:${ormType}`
					});
					return instance;
				};
				const mikroOrm = branch('mikro-orm');
				const typeOrm = branch('typeorm');

				const connection = orm.em.getConnection() as unknown as Connection;

				const call = async (branch: IDeleteBranch, id: string): Promise<ICallOutcome> => {
					statements.length = 0;
					events.length = 0;
					let answer: ICallOutcome['answer'];
					try {
						const result = await branch.deleteTask(id);
						answer = { affected: result.affected ?? 0 };
					} catch (error) {
						const failure = error as { getStatus?: () => number; message?: string } | null;
						answer = { status: failure?.getStatus?.() ?? 500, message: String(failure?.message ?? '') };
					}
					return { answer, statements: [...statements], events: [...events] };
				};

				const run = async (branch: IDeleteBranch): Promise<IOrmRun> => {
					await seed(connection);
					const trashed = await call(branch, IDS.TASK.TRASHED);
					const live = await call(branch, IDS.TASK.LIVE);
					const referencedLive = await call(branch, IDS.TASK.REFERENCED_LIVE);
					const referencedTrashed = await call(branch, IDS.TASK.REFERENCED_TRASHED);
					const otherOrganization = await call(branch, IDS.TASK.OTHER_ORGANIZATION);
					const otherTenant = await call(branch, IDS.TASK.OTHER_TENANT);
					const missing = await call(branch, IDS.TASK.MISSING);
					const rows = (await connection.execute('SELECT id FROM task ORDER BY id')) as Array<{ id: string }>;
					const count = async (sql: string) => ((await connection.execute(sql)) as Array<{ n: number }>)[0].n;
					const pragma = (await connection.execute('PRAGMA foreign_keys')) as Array<{ foreign_keys: number }>;
					const typeOrmPragma = (await dataSource.query('PRAGMA foreign_keys')) as Array<{
						foreign_keys: number;
					}>;
					return {
						trashed,
						live,
						referencedLive,
						referencedTrashed,
						otherOrganization,
						otherTenant,
						missing,
						remaining: rows.map((row) => row.id),
						references: {
							linkedIssues: await count('SELECT COUNT(*) AS n FROM task_linked_issues'),
							keyResults: await count('SELECT COUNT(*) AS n FROM key_result')
						},
						foreignKeys: { mikroOrm: pragma[0].foreign_keys, typeOrm: typeOrmPragma[0].foreign_keys }
					};
				};

				measured.mikroOrm = await run(mikroOrm);
				measured.typeOrm = await run(typeOrm);
			} finally {
				quiet.mockRestore();
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

/**
 * The tasks, a linked issue between the two referenced ones and a key result on each, written straight to the tables
 * (over any left by a previous run) with foreign keys off; they are enforced again before the calls.
 */
async function seed(connection: Connection): Promise<void> {
	await connection.execute('PRAGMA foreign_keys = OFF');
	await connection.execute('DELETE FROM task_linked_issues');
	await connection.execute('DELETE FROM key_result');
	await connection.execute('DELETE FROM task');
	await connection.execute('DELETE FROM tenant');
	// The tenants exist: a scoped read (the task the DELETED event carries) requires the task's tenant to be there.
	for (const tenantId of [IDS.TENANT, IDS.OTHER_TENANT]) {
		await connection.execute(`INSERT INTO tenant (id, name) VALUES (?, ?)`, [tenantId, `tenant ${tenantId}`]);
	}
	for (const task of TASKS) {
		await connection.execute(
			`INSERT INTO task (id, tenantId, organizationId, title, deletedAt)
			VALUES (?, ?, ?, ?, ${task.deleted ? "datetime('now')" : 'NULL'})`,
			[task.id, task.tenantId, task.organizationId, `task ${task.id}`]
		);
	}
	await connection.execute(
		`INSERT INTO task_linked_issues (id, tenantId, organizationId, action, taskFromId, taskToId)
		VALUES (?, ?, ?, 1, ?, ?)`,
		[IDS.LINKED_ISSUE, IDS.TENANT, IDS.ORGANIZATION, IDS.TASK.REFERENCED_LIVE, IDS.TASK.REFERENCED_TRASHED]
	);
	for (const [id, taskId] of [
		[IDS.KEY_RESULT.LIVE, IDS.TASK.REFERENCED_LIVE],
		[IDS.KEY_RESULT.TRASHED, IDS.TASK.REFERENCED_TRASHED]
	]) {
		await connection.execute(
			`INSERT INTO key_result (id, tenantId, organizationId, name, description, type, "update", progress, deadline,
				status, ownerId, taskId)
			VALUES (?, ?, ?, 'key result', '', 'TASK', 0, 0, 'No Custom Deadline', 'none', ?, ?)`,
			[id, IDS.TENANT, IDS.ORGANIZATION, IDS.USER, taskId]
		);
	}
	await connection.execute('PRAGMA foreign_keys = ON');
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

/** The DELETE statements of a call that name the task table. */
const deletesOfTask = (outcome: ICallOutcome) =>
	outcome.statements.filter((statement) => /^\s*(\[query\]\s*)?delete from [`"]?task[`"]?\s/i.test(statement));

const stillReferenced = { status: 409, message: expect.stringContaining('TASK_STILL_REFERENCED') };

describe('TaskService.deleteTask on a database (DELETE /tasks/:id)', () => {
	let measured: { mikroOrm: IOrmRun; typeOrm: IOrmRun };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each([['MikroORM', 'mikroOrm'] as const, ['TypeORM', 'typeOrm'] as const])('on %s', (_name, orm) => {
		const run = () => measured[orm];

		it('deletes a task in the trash for good, with one DELETE kept to the tenant that does not require it live', () => {
			expect(run().trashed.answer).toEqual({ affected: 1 });
			expect(run().remaining).not.toContain(IDS.TASK.TRASHED);
			const deletes = deletesOfTask(run().trashed);
			expect(deletes).toHaveLength(1);
			expect(deletes[0]).toMatch(/[`"]?tenantId[`"]?\s*=/i);
			expect(deletes[0]).not.toMatch(/[`"]?deletedAt[`"]? is null/i);
			// It published DELETED when it went to the trash, and is not announced twice.
			expect(run().trashed.events).toEqual([]);
		});

		it('deletes a live task for good and publishes its DELETED event, as before', () => {
			expect(run().live.answer).toEqual({ affected: 1 });
			expect(run().remaining).not.toContain(IDS.TASK.LIVE);
			expect(run().live.events).toEqual([`deleted:${IDS.TASK.LIVE}`]);
		});

		it('answers 409 for a live or trashed task other records still point at, and leaves them all as they were', () => {
			expect(run().foreignKeys).toEqual({ mikroOrm: 1, typeOrm: 1 });
			expect(run().referencedLive.answer).toEqual(stillReferenced);
			expect(run().referencedTrashed.answer).toEqual(stillReferenced);
			expect(deletesOfTask(run().referencedLive)).toHaveLength(1);
			expect(deletesOfTask(run().referencedTrashed)).toHaveLength(1);
			expect(run().remaining).toEqual(
				expect.arrayContaining([IDS.TASK.REFERENCED_LIVE, IDS.TASK.REFERENCED_TRASHED])
			);
			expect(run().references).toEqual({ linkedIssues: 1, keyResults: 2 });
			expect(run().referencedLive.events).toEqual([]);
		});

		it('deletes nothing outside the caller organization boundary or tenant, and nothing for an unknown id, as before', () => {
			expect(run().otherOrganization.answer).toEqual({ affected: 0 });
			expect(run().otherTenant.answer).toEqual({ affected: 0 });
			expect(run().missing.answer).toEqual({ affected: 0 });
			expect(run().remaining).toEqual(
				expect.arrayContaining([IDS.TASK.OTHER_ORGANIZATION, IDS.TASK.OTHER_TENANT])
			);
		});

		it('removes only the two tasks it was asked to and could delete', () => {
			expect(run().remaining).toEqual(
				[
					IDS.TASK.REFERENCED_LIVE,
					IDS.TASK.REFERENCED_TRASHED,
					IDS.TASK.OTHER_ORGANIZATION,
					IDS.TASK.OTHER_TENANT
				].sort()
			);
		});
	});
});
