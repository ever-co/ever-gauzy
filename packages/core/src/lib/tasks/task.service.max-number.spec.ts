import '../core/entities/internal';

import { DataSource, EntitySchema } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { IGetTaskOptions } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TaskService } from './task.service';

/**
 * #10724 — a soft-deleted task keeps its number in the `taskNumber` unique index (`projectId`, `number`). The next
 * number was read from live tasks only, so once the highest-numbered task of a project was soft-deleted, every
 * task created there was handed that task's number and refused with a duplicate key.
 *
 * `getMaxTaskNumberByProject(options, { withDeleted: true })`, which every creation path asks for, counts the
 * soft-deleted tasks too; without the flag the max-number read routes keep answering for live tasks only. Each
 * case runs the service's real method against a real in-memory SQLite database under each ORM, with the
 * soft-delete mechanism each ORM uses in production — MikroORM's `@SoftDeletable` filter, and TypeORM's
 * delete-date column.
 */

const TENANT_A = '80000000-0000-4000-8000-00000000000a';
const TENANT_B = '80000000-0000-4000-8000-00000000000b';
const ORGANIZATION_A = '80000000-0000-4000-8000-0000000000a1';
const ORGANIZATION_B = '80000000-0000-4000-8000-0000000000b1';
const PROJECT = '80000000-0000-4000-8000-0000000000d1';
const OTHER_PROJECT = '80000000-0000-4000-8000-0000000000d2';
const DELETED_AT = new Date('2026-01-01T00:00:00.000Z');

let seq = 0;
const task = (
	number: number | null,
	projectId: string | null,
	deleted = false,
	tenantId = TENANT_A,
	organizationId = ORGANIZATION_A
) => ({
	id: `80000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`,
	number,
	projectId,
	tenantId,
	organizationId,
	deletedAt: deleted ? DELETED_AT : null
});

const SEED = [
	// The project: live 1 and 2, soft-deleted 3, and a soft-deleted task that predates task numbers
	task(1, PROJECT),
	task(2, PROJECT),
	task(3, PROJECT, true),
	task(null, PROJECT, true),
	// Without a project: live 4, soft-deleted 5
	task(4, null),
	task(5, null, true),
	// Higher numbers that are not the project's: another project, organization and tenant
	task(7, OTHER_PROJECT, true),
	task(8, PROJECT, true, TENANT_A, ORGANIZATION_B),
	task(9, PROJECT, true, TENANT_B, ORGANIZATION_A)
];

const TaskSchema = new EntitySchema<any>({
	name: 'Task',
	tableName: 'task',
	columns: {
		id: { primary: true, type: 'varchar' },
		number: { type: 'integer', nullable: true },
		projectId: { type: 'varchar', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

@SoftDeletable(() => TaskMaxNumberRow, 'deletedAt', () => new Date())
@Entity({ tableName: 'task' })
class TaskMaxNumberRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'integer', nullable: true })
	number?: number | null;

	@Property({ type: 'string', nullable: true })
	projectId?: string | null;

	@Property({ type: 'string', nullable: true })
	tenantId?: string | null;

	@Property({ type: 'string', nullable: true })
	organizationId?: string | null;

	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;
}

/** The service over one ORM's repository; nothing else it holds is reached by this read. */
function serviceOver(typeOrmRepository: unknown, mikroOrmRepository: unknown): TaskService {
	const stub = {};
	return new TaskService(
		typeOrmRepository as any,
		mikroOrmRepository as any,
		...(Array.from({ length: 9 }, () => stub) as [never, never, never, never, never, never, never, never, never])
	);
}

interface IHarness {
	service(): TaskService;
	close(): Promise<void>;
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TaskSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const tasks = dataSource.getRepository('Task');
	await tasks.save(SEED);

	return {
		service: () => serviceOver(tasks, {}),
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [TaskMaxNumberRow],
		extensions: [SoftDeleteHandler],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.schema.createSchema();

	const em = orm.em.fork();
	await em.persistAndFlush(SEED.map((row) => em.create(TaskMaxNumberRow, row)));

	return {
		// A fresh fork per read, so a row is answered because the store answered it
		service: () => serviceOver({ metadata: { tableName: 'task' } }, orm.em.fork().getRepository(TaskMaxNumberRow)),
		close: () => orm.close(true)
	};
}

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
])('TaskService.getMaxTaskNumberByProject (%s)', (ormType, createHarness) => {
	let harness: IHarness;

	beforeAll(async () => {
		harness = await createHarness();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The method as the callers call it; the flag is passed loosely so the case runs against any signature. */
	const maxNumber = (projectId: string | null, flags?: { withDeleted?: boolean }): Promise<number> => {
		const service = harness.service() as unknown as {
			getMaxTaskNumberByProject(options: IGetTaskOptions, flags?: unknown): Promise<number>;
		};
		return service.getMaxTaskNumberByProject(
			{ tenantId: TENANT_A, organizationId: ORGANIZATION_A, projectId },
			flags
		);
	};

	it("numbers above the project's soft-deleted tasks when asked to, as task creation is", async () => {
		expect(await maxNumber(PROJECT, { withDeleted: true })).toBe(3);
	});

	it('numbers above the soft-deleted tasks without a project too', async () => {
		expect(await maxNumber(null, { withDeleted: true })).toBe(5);
	});

	it('answers for live tasks only without the flag, as the max-number read routes do', async () => {
		expect(await maxNumber(PROJECT)).toBe(2);
		expect(await maxNumber(PROJECT, { withDeleted: false })).toBe(2);
		expect(await maxNumber(null)).toBe(4);
	});

	it('answers 0 for a project with no task', async () => {
		expect(await maxNumber('80000000-0000-4000-8000-0000000000d9', { withDeleted: true })).toBe(0);
	});
});
