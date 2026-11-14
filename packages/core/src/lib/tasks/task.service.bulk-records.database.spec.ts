import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { ITaskBulkChanges, IUser, PermissionsEnum, TaskPriorityEnum } from '@gauzy/contracts';
import { coreEntities } from '../core/entities';
import {
	Organization,
	OrganizationSprintTaskHistory,
	TaskPriority,
	TaskSize,
	TaskStatus,
	Tenant,
	User
} from '../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { serializeEmbeddedTransactions } from '../database/embedded-transaction-queue';
import { Task } from './task.entity';
import { TaskService } from './task.service';

/**
 * `POST /tasks/bulk-update` (and `bulkUpdateTasks`) with a status, priority or size named by its record, on a real
 * database with the tables TypeORM creates:
 *
 * - **a record of the task's scope only.** The task organization's own record, the tenant's shared one (no
 *   organization) or a platform default (no tenant) is taken. Another organization's or another tenant's record, or
 *   an id that names none, is refused for each task, and the task stays as it was.
 * - **a priority or size named by its record alone takes the record's name**, as the task page writes it
 *   (`value || name`): a team's own priority is not one of the platform's values, so the change cannot name it, and
 *   the task would otherwise keep showing the priority it had. The undo (the previous values sent back) puts back
 *   both the record and the name.
 * - **the previous values leave out a name the record the task held gives back**, so a client that cannot send a
 *   team's own name knows the record alone puts it back; a name the record does not give back stays.
 *
 * SQLite runs by default. Postgres runs when the entities are mapped for it and an empty, throwaway database is given:
 *
 *   DB_TYPE=postgres GAUZY_TASK_SPEC_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 */

const TIMEOUT = 15 * 60 * 1000;

const fixture = createTenantFixture({
	tenantId: '84000000-0000-4000-8000-00000000000a',
	organizationId: '84000000-0000-4000-8000-0000000000a1',
	user: { id: '84000000-0000-4000-8000-0000000000b1' } as IUser
});
const TENANT = fixture.tenantId;
const ORGANIZATION = fixture.organizationId;
const OTHER_ORGANIZATION = '84000000-0000-4000-8000-0000000000a2';
const OTHER_TENANT = '84000000-0000-4000-8000-00000000000b';
const OTHER_TENANT_ORGANIZATION = '84000000-0000-4000-8000-0000000000a3';

const TASK_ONE = '84000000-0000-4000-8000-000000000001';
const TASK_TWO = '84000000-0000-4000-8000-000000000002';

/** The organization's own priority, which is not one of the platform's values. */
const PRIORITY_OWN = '84000000-0000-4000-8000-0000000000c1';
/** The tenant's shared priority (no organization). */
const PRIORITY_SHARED = '84000000-0000-4000-8000-0000000000c2';
/** A platform default (no tenant, no organization). */
const PRIORITY_DEFAULT = '84000000-0000-4000-8000-0000000000c3';
const PRIORITY_OTHER_ORGANIZATION = '84000000-0000-4000-8000-0000000000c4';
const PRIORITY_OTHER_TENANT = '84000000-0000-4000-8000-0000000000c5';
const PRIORITY_UNKNOWN = '84000000-0000-4000-8000-0000000000c9';

const SIZE_OWN = '84000000-0000-4000-8000-0000000000d1';
const SIZE_OTHER_ORGANIZATION = '84000000-0000-4000-8000-0000000000d4';
const SIZE_OTHER_TENANT = '84000000-0000-4000-8000-0000000000d5';

const STATUS_OWN = '84000000-0000-4000-8000-0000000000e1';
const STATUS_OTHER_ORGANIZATION = '84000000-0000-4000-8000-0000000000e4';

const TABLES = ['organization_sprint_task_history', 'task', 'task_priority', 'task_size', 'task_status', 'organization', 'user', 'tenant'];

/** The database the spec runs on. */
interface Dialect {
	options: () => DataSourceOptions;
	/** Empties the tables the spec writes, whatever refers to them. */
	reset: (dataSource: DataSource) => Promise<void>;
}

const SQLITE: Dialect = {
	options: () => ({
		type: 'better-sqlite3',
		database: path.join(os.tmpdir(), `gauzy-task-bulk-records-${process.pid}-${Date.now()}.sqlite3`)
	}),
	reset: async (dataSource) => {
		await dataSource.query('PRAGMA foreign_keys = OFF');
		for (const table of TABLES) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		await dataSource.query('PRAGMA foreign_keys = ON');
	}
};

const POSTGRES: Dialect = {
	options: () => ({ type: 'postgres', url: process.env.GAUZY_TASK_SPEC_POSTGRES_URL }),
	reset: async (dataSource) => {
		await dataSource.query(`TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`);
	}
};

function exercise(dialect: Dialect) {
	let dataSource: DataSource;
	let service: TaskService;
	let restore: () => void;

	/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
	const insert = async (entity: EntityTarget<ObjectLiteral>, row: Record<string, unknown>) => {
		const values: Record<string, unknown> = { ...row };
		for (const column of dataSource.getMetadata(entity).columns) {
			const needsNoValue =
				column.isNullable ||
				column.default !== undefined ||
				column.isGenerated ||
				column.isCreateDate ||
				column.isUpdateDate ||
				column.isVirtual ||
				!!column.relationMetadata;
			if (column.propertyName in values || needsNoValue) continue;
			const type = typeof column.type === 'function' ? column.type.name.toLowerCase() : String(column.type).toLowerCase();
			let placeholder: unknown = 'x';
			if (/int|number|numeric|decimal|real|float|double/.test(type)) placeholder = 0;
			else if (/bool/.test(type)) placeholder = false;
			else if (/date|time/.test(type)) placeholder = new Date('2026-01-01T00:00:00Z');
			values[column.propertyName] = placeholder;
		}
		await dataSource.createQueryBuilder().insert().into(entity).values(values).execute();
	};

	const taskRow = (id: string) =>
		dataSource.getRepository(Task).findOne({
			where: { id },
			select: { id: true, status: true, taskStatusId: true, priority: true, taskPriorityId: true, size: true, taskSizeId: true }
		});

	const bulkUpdate = (changes: ITaskBulkChanges, taskIds = [TASK_ONE, TASK_TWO]) =>
		service.bulkUpdate({ organizationId: ORGANIZATION, taskIds, changes } as never, (id, update) => service.update(id, update));

	beforeAll(async () => {
		// As the platform builds its data source: on SQLite, transactions take turns on the one connection.
		dataSource = serializeEmbeddedTransactions(
			new DataSource({ ...dialect.options(), entities: coreEntities, synchronize: true, logging: false } as DataSourceOptions)
		);
		await dataSource.initialize();
	}, TIMEOUT);

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		const file = (dataSource.options as { database?: unknown }).database;
		await dataSource.destroy();
		if (typeof file === 'string' && file.endsWith('.sqlite3')) fs.rmSync(file, { force: true });
	});

	beforeEach(async () => {
		await dialect.reset(dataSource);
		const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
		await insert(Tenant, { id: TENANT, name: 'Tenant' });
		await insert(Tenant, { id: OTHER_TENANT, name: 'Other tenant' });
		await insert(Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
		await insert(Organization, { id: OTHER_ORGANIZATION, tenantId: TENANT, name: 'Other organization' });
		await insert(Organization, { id: OTHER_TENANT_ORGANIZATION, tenantId: OTHER_TENANT, name: 'Other tenant organization' });
		await insert(User, { id: fixture.user.id, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });

		await insert(TaskPriority, { ...scope, id: PRIORITY_OWN, name: 'P0', value: 'p0' });
		await insert(TaskPriority, { tenantId: TENANT, organizationId: null, id: PRIORITY_SHARED, name: 'Shared', value: 'shared-priority' });
		await insert(TaskPriority, { tenantId: null, organizationId: null, id: PRIORITY_DEFAULT, name: 'Urgent', value: TaskPriorityEnum.URGENT, isSystem: true });
		await insert(TaskPriority, { tenantId: TENANT, organizationId: OTHER_ORGANIZATION, id: PRIORITY_OTHER_ORGANIZATION, name: 'Theirs', value: 'theirs' });
		await insert(TaskPriority, { tenantId: OTHER_TENANT, organizationId: OTHER_TENANT_ORGANIZATION, id: PRIORITY_OTHER_TENANT, name: 'Foreign', value: 'foreign' });
		await insert(TaskSize, { ...scope, id: SIZE_OWN, name: 'Huge', value: 'huge' });
		await insert(TaskSize, { tenantId: TENANT, organizationId: OTHER_ORGANIZATION, id: SIZE_OTHER_ORGANIZATION, name: 'Theirs', value: 'theirs' });
		await insert(TaskSize, { tenantId: OTHER_TENANT, organizationId: OTHER_TENANT_ORGANIZATION, id: SIZE_OTHER_TENANT, name: 'Foreign', value: 'foreign' });
		await insert(TaskStatus, { ...scope, id: STATUS_OWN, name: 'QA', value: 'qa' });
		await insert(TaskStatus, { tenantId: TENANT, organizationId: OTHER_ORGANIZATION, id: STATUS_OTHER_ORGANIZATION, name: 'Theirs', value: 'theirs' });

		await insert(Task, { ...scope, id: TASK_ONE, title: 'One', number: 1, status: 'open', priority: TaskPriorityEnum.LOW });
		await insert(Task, { ...scope, id: TASK_TWO, title: 'Two', number: 2, status: 'open', priority: TaskPriorityEnum.LOW });

		({ restore } = asTenantUser(fixture, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		// The service as Nest builds it, over the real repositories; the collaborators the update only notifies are stand-ins.
		const stub = (members: Record<string, unknown>) => members as never;
		service = new TaskService(
			dataSource.getRepository(Task) as never,
			stub({}),
			dataSource.getRepository(OrganizationSprintTaskHistory) as never,
			stub({ publish: jest.fn() }),
			stub({}),
			stub({ delete: jest.fn() }),
			stub({ updateEntityMentions: jest.fn() }),
			stub({ logActivity: jest.fn() }),
			stub({ publishNotificationEvent: jest.fn() }),
			stub({}),
			stub({ canManageEmployee: jest.fn(async () => true) })
		);
	}, TIMEOUT);

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const AS_INSERTED = { status: 'open', taskStatusId: null, priority: TaskPriorityEnum.LOW, taskPriorityId: null, size: null, taskSizeId: null };

	it(
		'gives a priority and a size named by their records alone the records’ names, and the undo puts both back',
		async () => {
			const outcome = await bulkUpdate({ taskPriorityId: PRIORITY_OWN, taskSizeId: SIZE_OWN });

			expect(outcome).toMatchObject({ applied: 2, refused: 0 });
			for (const taskId of [TASK_ONE, TASK_TWO]) {
				expect(await taskRow(taskId)).toMatchObject({ priority: 'p0', taskPriorityId: PRIORITY_OWN, size: 'huge', taskSizeId: SIZE_OWN });
			}
			// The previous values hold the names too, so the undo puts them back with the records.
			const previous = outcome.results.map((result) => result.previous);
			expect(previous).toEqual([
				{ priority: TaskPriorityEnum.LOW, taskPriorityId: null, size: null, taskSizeId: null },
				{ priority: TaskPriorityEnum.LOW, taskPriorityId: null, size: null, taskSizeId: null }
			]);

			const undone = await service.bulkUpdate(
				{ organizationId: ORGANIZATION, items: outcome.results.map(({ taskId, previous }) => ({ taskId, changes: previous })) } as never,
				(id, update) => service.update(id, update)
			);
			expect(undone).toMatchObject({ applied: 2, refused: 0 });
			for (const taskId of [TASK_ONE, TASK_TWO]) {
				expect(await taskRow(taskId)).toMatchObject(AS_INSERTED);
			}
		},
		TIMEOUT
	);

	it(
		'puts back a team’s own priority from its record alone, and leaves out the name the record gives back',
		async () => {
			await bulkUpdate({ taskPriorityId: PRIORITY_OWN });
			const outcome = await bulkUpdate({ taskPriorityId: PRIORITY_SHARED });
			expect(await taskRow(TASK_ONE)).toMatchObject({ priority: 'shared-priority', taskPriorityId: PRIORITY_SHARED });

			// `p0` is not one of the platform's values (the route would refuse it), and the record gives it back.
			expect(outcome.results.map((result) => result.previous)).toEqual([{ taskPriorityId: PRIORITY_OWN }, { taskPriorityId: PRIORITY_OWN }]);
			const items = outcome.results.map(({ taskId, previous }) => ({ taskId, changes: previous }));
			await service.bulkUpdate({ organizationId: ORGANIZATION, items } as never, (id, update) => service.update(id, update));

			expect(await taskRow(TASK_ONE)).toMatchObject({ priority: 'p0', taskPriorityId: PRIORITY_OWN });
		},
		TIMEOUT
	);

	it(
		'keeps a name in the previous values when the record the task held does not give it back',
		async () => {
			await bulkUpdate({ taskPriorityId: PRIORITY_OWN }, [TASK_ONE]);
			// The record is renamed after the change, and the other task holds a name its record never had.
			await dataSource.getRepository(TaskPriority).update({ id: PRIORITY_OWN }, { value: 'p0-renamed' });
			await dataSource.getRepository(Task).update({ id: TASK_TWO }, { taskPriorityId: PRIORITY_OWN } as never);

			const outcome = await bulkUpdate({ taskPriorityId: PRIORITY_SHARED });

			expect(outcome.results.map((result) => result.previous)).toEqual([
				{ priority: 'p0', taskPriorityId: PRIORITY_OWN },
				{ priority: TaskPriorityEnum.LOW, taskPriorityId: PRIORITY_OWN }
			]);
		},
		TIMEOUT
	);

	it(
		'answers the applied tasks with their previous values whole when the records they held cannot be read',
		async () => {
			await bulkUpdate({ taskPriorityId: PRIORITY_OWN });
			// The second read of priorities (the records the tasks held, after the changes) fails.
			const find = dataSource.manager.find.bind(dataSource.manager);
			let priorityReads = 0;
			jest.spyOn(dataSource.manager, 'find').mockImplementation((async (entity: unknown, options: unknown) => {
				if (entity === TaskPriority && ++priorityReads === 2) throw new Error('connection lost');
				return find(entity as never, options as never);
			}) as never);
			jest.spyOn(console, 'warn').mockImplementation(() => undefined);

			const outcome = await bulkUpdate({ taskPriorityId: PRIORITY_SHARED });

			expect(priorityReads).toBe(2);
			expect(outcome).toMatchObject({ applied: 2, refused: 0 });
			expect(outcome.results.map((result) => result.previous)).toEqual([
				{ priority: 'p0', taskPriorityId: PRIORITY_OWN },
				{ priority: 'p0', taskPriorityId: PRIORITY_OWN }
			]);
			expect(await taskRow(TASK_ONE)).toMatchObject({ priority: 'shared-priority', taskPriorityId: PRIORITY_SHARED });
		},
		TIMEOUT
	);

	it(
		'keeps a platform value sent beside its record as it was sent',
		async () => {
			await bulkUpdate({ taskPriorityId: PRIORITY_DEFAULT, priority: TaskPriorityEnum.URGENT });

			expect(await taskRow(TASK_ONE)).toMatchObject({ priority: TaskPriorityEnum.URGENT, taskPriorityId: PRIORITY_DEFAULT });
		},
		TIMEOUT
	);

	it(
		'takes the tenant’s shared priority and a platform default',
		async () => {
			expect(await bulkUpdate({ taskPriorityId: PRIORITY_SHARED }, [TASK_ONE])).toMatchObject({ applied: 1, refused: 0 });
			expect(await taskRow(TASK_ONE)).toMatchObject({ priority: 'shared-priority', taskPriorityId: PRIORITY_SHARED });

			expect(await bulkUpdate({ taskPriorityId: PRIORITY_DEFAULT }, [TASK_TWO])).toMatchObject({ applied: 1, refused: 0 });
			expect(await taskRow(TASK_TWO)).toMatchObject({ priority: TaskPriorityEnum.URGENT, taskPriorityId: PRIORITY_DEFAULT });
		},
		TIMEOUT
	);

	it.each([
		['priority', { taskPriorityId: PRIORITY_OTHER_ORGANIZATION }, 'TASK_PRIORITY_NOT_FOUND'],
		['size', { taskSizeId: SIZE_OTHER_ORGANIZATION }, 'TASK_SIZE_NOT_FOUND'],
		['status', { taskStatusId: STATUS_OTHER_ORGANIZATION }, 'TASK_STATUS_NOT_FOUND']
	] as Array<[string, ITaskBulkChanges, string]>)(
		'refuses another organization’s %s for every task, and changes none',
		async (_field, changes, code) => {
			const outcome = await bulkUpdate(changes);

			expect(outcome).toMatchObject({ applied: 0, refused: 2 });
			for (const result of outcome.results) {
				expect(result).toMatchObject({ ok: false, error: expect.stringContaining(code) });
			}
			for (const taskId of [TASK_ONE, TASK_TWO]) {
				expect(await taskRow(taskId)).toMatchObject(AS_INSERTED);
			}
		},
		TIMEOUT
	);

	it.each([
		['priority of another tenant', { taskPriorityId: PRIORITY_OTHER_TENANT }, 'TASK_PRIORITY_NOT_FOUND'],
		['size of another tenant', { taskSizeId: SIZE_OTHER_TENANT }, 'TASK_SIZE_NOT_FOUND'],
		['priority that does not exist', { taskPriorityId: PRIORITY_UNKNOWN }, 'TASK_PRIORITY_NOT_FOUND']
	] as Array<[string, ITaskBulkChanges, string]>)(
		'refuses a %s, and changes no task',
		async (_case, changes, code) => {
			const outcome = await bulkUpdate(changes);

			expect(outcome).toMatchObject({ applied: 0, refused: 2 });
			for (const result of outcome.results) {
				expect(result).toMatchObject({ ok: false, error: expect.stringContaining(code) });
			}
			for (const taskId of [TASK_ONE, TASK_TWO]) {
				expect(await taskRow(taskId)).toMatchObject(AS_INSERTED);
			}
		},
		TIMEOUT
	);

	it(
		'refuses only the task whose undo item names another organization’s record',
		async () => {
			const outcome = await service.bulkUpdate(
				{
					organizationId: ORGANIZATION,
					items: [
						{ taskId: TASK_ONE, changes: { taskPriorityId: PRIORITY_OWN } },
						{ taskId: TASK_TWO, changes: { taskPriorityId: PRIORITY_OTHER_ORGANIZATION } }
					]
				} as never,
				(id, update) => service.update(id, update)
			);

			expect(outcome).toMatchObject({ applied: 1, refused: 1 });
			expect(await taskRow(TASK_ONE)).toMatchObject({ priority: 'p0', taskPriorityId: PRIORITY_OWN });
			expect(await taskRow(TASK_TWO)).toMatchObject(AS_INSERTED);
		},
		TIMEOUT
	);

	it(
		'names a status by its record alone without touching the status text, as before',
		async () => {
			await bulkUpdate({ taskStatusId: STATUS_OWN });

			expect(await taskRow(TASK_ONE)).toMatchObject({ status: 'open', taskStatusId: STATUS_OWN });
		},
		TIMEOUT
	);

	it(
		'clears a priority’s record with null and leaves its name',
		async () => {
			await bulkUpdate({ taskPriorityId: PRIORITY_OWN });
			await bulkUpdate({ taskPriorityId: null });

			expect(await taskRow(TASK_ONE)).toMatchObject({ priority: 'p0', taskPriorityId: null });
		},
		TIMEOUT
	);
}

(isPostgres() ? describe.skip : describe)('TaskService bulk update with status, priority and size records, on a real SQLite database', () => {
	exercise(SQLITE);
});

(isPostgres() && process.env.GAUZY_TASK_SPEC_POSTGRES_URL ? describe : describe.skip)(
	'TaskService bulk update with status, priority and size records, on a real Postgres database',
	() => {
		exercise(POSTGRES);
	}
);
