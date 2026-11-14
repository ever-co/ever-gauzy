import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { ITaskUpdateInput, IUser, PermissionsEnum, TaskPriorityEnum } from '@gauzy/contracts';
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
import { TaskCreateCommand } from './commands/task-create.command';
import { TaskCreateHandler } from './commands/handlers/task-create.handler';
import { Task } from './task.entity';
import { TaskService } from './task.service';

/**
 * `PUT /tasks/:id` (and `updateTask`, the chat card and every other caller of the task update) with a status, priority
 * or size named by its record, on a real database with the tables TypeORM creates. The same rules as the bulk update:
 *
 * - **a record of the task's scope only.** The task organization's own record, the tenant's shared one (no
 *   organization) or a platform default (no tenant) is taken. Another organization's or another tenant's record, or an
 *   id that names none, refuses the update with `TASK_<KIND>_NOT_FOUND`, and the task stays as it was. A record named
 *   by its relation (`taskPriority: { id }`) is judged the same way.
 * - **a record the task already holds is not judged again**, so a client that sends the whole task back keeps working.
 * - **a priority or size named by its record alone takes the record's name** (its value, else its name), as the task
 *   page writes it. A name sent beside it is kept as sent; a name sent alone is written as before; a status keeps its
 *   text.
 *
 * `POST /tasks` (and `createTask`, the bulk creates, the screening tasks and the integrations' imports, which all run
 * the create command and `TaskService.create`) the same way: a record of the organization the task is created in, the
 * tenant's shared one or a platform default, else the create is refused and no task is written; a priority or size
 * named by its record alone takes the record's name; a task created with names only, or with its organization's
 * records and their names (as an import sends them), is written as before.
 *
 * SQLite runs by default. Postgres runs when the entities are mapped for it and an empty, throwaway database is given:
 *
 *   DB_TYPE=postgres GAUZY_TASK_SPEC_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 */

const TIMEOUT = 15 * 60 * 1000;

const fixture = createTenantFixture({
	tenantId: '85000000-0000-4000-8000-00000000000a',
	organizationId: '85000000-0000-4000-8000-0000000000a1',
	user: { id: '85000000-0000-4000-8000-0000000000b1' } as IUser
});
const TENANT = fixture.tenantId;
const ORGANIZATION = fixture.organizationId;
const OTHER_ORGANIZATION = '85000000-0000-4000-8000-0000000000a2';
const OTHER_TENANT = '85000000-0000-4000-8000-00000000000b';
const OTHER_TENANT_ORGANIZATION = '85000000-0000-4000-8000-0000000000a3';

const TASK = '85000000-0000-4000-8000-000000000001';

/** The organization's own priority, which is not one of the platform's values. */
const PRIORITY_OWN = '85000000-0000-4000-8000-0000000000c1';
/** The tenant's shared priority (no organization), with no value: its name is what a task holds. */
const PRIORITY_SHARED = '85000000-0000-4000-8000-0000000000c2';
/** A platform default (no tenant, no organization). */
const PRIORITY_DEFAULT = '85000000-0000-4000-8000-0000000000c3';
const PRIORITY_OTHER_ORGANIZATION = '85000000-0000-4000-8000-0000000000c4';
const PRIORITY_OTHER_TENANT = '85000000-0000-4000-8000-0000000000c5';
const PRIORITY_UNKNOWN = '85000000-0000-4000-8000-0000000000c9';

const SIZE_OWN = '85000000-0000-4000-8000-0000000000d1';
const SIZE_OTHER_ORGANIZATION = '85000000-0000-4000-8000-0000000000d4';
const SIZE_OTHER_TENANT = '85000000-0000-4000-8000-0000000000d5';

const STATUS_OWN = '85000000-0000-4000-8000-0000000000e1';
const STATUS_OTHER_ORGANIZATION = '85000000-0000-4000-8000-0000000000e4';

/** The records an update or a create may not give a task of the organization, with the code it is refused with. */
const REFUSED: Array<[string, Record<string, unknown>, string]> = [
	['another organization’s priority', { taskPriorityId: PRIORITY_OTHER_ORGANIZATION }, 'TASK_PRIORITY_NOT_FOUND'],
	['another organization’s size', { taskSizeId: SIZE_OTHER_ORGANIZATION }, 'TASK_SIZE_NOT_FOUND'],
	['another organization’s status', { taskStatusId: STATUS_OTHER_ORGANIZATION }, 'TASK_STATUS_NOT_FOUND'],
	[
		'another organization’s priority named with a platform value',
		{ taskPriorityId: PRIORITY_OTHER_ORGANIZATION, priority: TaskPriorityEnum.HIGH },
		'TASK_PRIORITY_NOT_FOUND'
	],
	[
		'another organization’s priority named by its relation',
		{ taskPriority: { id: PRIORITY_OTHER_ORGANIZATION } },
		'TASK_PRIORITY_NOT_FOUND'
	],
	['another tenant’s priority', { taskPriorityId: PRIORITY_OTHER_TENANT }, 'TASK_PRIORITY_NOT_FOUND'],
	['another tenant’s size', { taskSizeId: SIZE_OTHER_TENANT }, 'TASK_SIZE_NOT_FOUND'],
	['a priority that does not exist', { taskPriorityId: PRIORITY_UNKNOWN }, 'TASK_PRIORITY_NOT_FOUND'],
	['a size named by a relation whose id is no uuid', { taskSize: { id: 'not-a-uuid' } }, 'TASK_SIZE_NOT_FOUND'],
	[
		'another organization’s priority named by its id beside a cleared relation',
		{ taskPriority: null, taskPriorityId: PRIORITY_OTHER_ORGANIZATION },
		'TASK_PRIORITY_NOT_FOUND'
	]
];

const TABLES = [
	'organization_sprint_task_history',
	'task',
	'task_priority',
	'task_size',
	'task_status',
	'organization',
	'user',
	'tenant'
];

/** The database the spec runs on. */
interface Dialect {
	options: () => DataSourceOptions;
	/** Empties the tables the spec writes, whatever refers to them. */
	reset: (dataSource: DataSource) => Promise<void>;
}

const SQLITE: Dialect = {
	options: () => ({
		type: 'better-sqlite3',
		database: path.join(os.tmpdir(), `gauzy-task-single-records-${process.pid}-${Date.now()}.sqlite3`)
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
	let handler: TaskCreateHandler;
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
			const type =
				typeof column.type === 'function' ? column.type.name.toLowerCase() : String(column.type).toLowerCase();
			let placeholder: unknown = 'x';
			if (/int|number|numeric|decimal|real|float|double/.test(type)) placeholder = 0;
			else if (/bool/.test(type)) placeholder = false;
			else if (/date|time/.test(type)) placeholder = new Date('2026-01-01T00:00:00Z');
			values[column.propertyName] = placeholder;
		}
		await dataSource.createQueryBuilder().insert().into(entity).values(values).execute();
	};

	const taskRow = () =>
		dataSource.getRepository(Task).findOne({
			where: { id: TASK },
			select: {
				id: true,
				title: true,
				status: true,
				taskStatusId: true,
				priority: true,
				taskPriorityId: true,
				size: true,
				taskSizeId: true
			}
		});

	/** A task created as `POST /tasks` and `createTask` create it: through the create command and the service. */
	const create = (input: Record<string, unknown>) =>
		handler.execute(
			new TaskCreateCommand(
				{ organizationId: ORGANIZATION, title: 'Created', status: 'open', ...input } as never,
				false
			)
		);

	const createdRows = () =>
		dataSource.getRepository(Task).find({
			where: { title: 'Created' },
			select: {
				id: true,
				title: true,
				organizationId: true,
				status: true,
				taskStatusId: true,
				priority: true,
				taskPriorityId: true,
				size: true,
				taskSizeId: true
			}
		});

	const update = (input: Record<string, unknown>) =>
		service.update(TASK, { organizationId: ORGANIZATION, ...input } as Partial<ITaskUpdateInput>);

	beforeAll(async () => {
		// As the platform builds its data source: on SQLite, transactions take turns on the one connection.
		dataSource = serializeEmbeddedTransactions(
			new DataSource({
				...dialect.options(),
				entities: coreEntities,
				synchronize: true,
				logging: false
			} as DataSourceOptions)
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
		await insert(Organization, {
			id: OTHER_TENANT_ORGANIZATION,
			tenantId: OTHER_TENANT,
			name: 'Other tenant organization'
		});
		await insert(User, { id: fixture.user.id, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });

		await insert(TaskPriority, { ...scope, id: PRIORITY_OWN, name: 'P0', value: 'p0' });
		await insert(TaskPriority, {
			tenantId: TENANT,
			organizationId: null,
			id: PRIORITY_SHARED,
			name: 'Shared',
			value: ''
		});
		await insert(TaskPriority, {
			tenantId: null,
			organizationId: null,
			id: PRIORITY_DEFAULT,
			name: 'Urgent',
			value: TaskPriorityEnum.URGENT,
			isSystem: true
		});
		await insert(TaskPriority, {
			tenantId: TENANT,
			organizationId: OTHER_ORGANIZATION,
			id: PRIORITY_OTHER_ORGANIZATION,
			name: 'Theirs',
			value: 'theirs'
		});
		await insert(TaskPriority, {
			tenantId: OTHER_TENANT,
			organizationId: OTHER_TENANT_ORGANIZATION,
			id: PRIORITY_OTHER_TENANT,
			name: 'Foreign',
			value: 'foreign'
		});
		await insert(TaskSize, { ...scope, id: SIZE_OWN, name: 'Huge', value: 'huge' });
		await insert(TaskSize, {
			tenantId: TENANT,
			organizationId: OTHER_ORGANIZATION,
			id: SIZE_OTHER_ORGANIZATION,
			name: 'Theirs',
			value: 'theirs'
		});
		await insert(TaskSize, {
			tenantId: OTHER_TENANT,
			organizationId: OTHER_TENANT_ORGANIZATION,
			id: SIZE_OTHER_TENANT,
			name: 'Foreign',
			value: 'foreign'
		});
		await insert(TaskStatus, { ...scope, id: STATUS_OWN, name: 'QA', value: 'qa' });
		await insert(TaskStatus, {
			tenantId: TENANT,
			organizationId: OTHER_ORGANIZATION,
			id: STATUS_OTHER_ORGANIZATION,
			name: 'Theirs',
			value: 'theirs'
		});

		await insert(Task, {
			...scope,
			id: TASK,
			title: 'One',
			number: 1,
			status: 'open',
			priority: TaskPriorityEnum.LOW
		});

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
		// The create command as Nest builds it, over that service; what it only notifies or looks up is a stand-in.
		handler = new TaskCreateHandler(
			stub({ publish: jest.fn() }),
			stub({ publish: jest.fn() }),
			service,
			stub({ findOneByIdString: jest.fn(async () => null) }),
			stub({
				findOneByIdString: jest.fn(async () => null),
				findActiveEmployeesByEmployeeIds: jest.fn(async () => [])
			}),
			stub({ publishMention: jest.fn() }),
			stub({ logActivity: jest.fn() }),
			stub({ publishNotificationEvent: jest.fn() })
		);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	}, TIMEOUT);

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const AS_INSERTED = {
		title: 'One',
		status: 'open',
		taskStatusId: null,
		priority: TaskPriorityEnum.LOW,
		taskPriorityId: null,
		size: null,
		taskSizeId: null
	};

	it.each(REFUSED)(
		'refuses %s, and changes nothing of the task',
		async (_case, changes, code) => {
			await expect(update({ title: 'Renamed', ...changes })).rejects.toThrow(code);

			expect(await taskRow()).toMatchObject(AS_INSERTED);
		},
		TIMEOUT
	);

	it(
		'gives a priority and a size named by their records alone the records’ names',
		async () => {
			await update({ taskPriorityId: PRIORITY_OWN, taskSizeId: SIZE_OWN });

			expect(await taskRow()).toMatchObject({
				priority: 'p0',
				taskPriorityId: PRIORITY_OWN,
				size: 'huge',
				taskSizeId: SIZE_OWN
			});
		},
		TIMEOUT
	);

	it(
		'takes the tenant’s shared priority (named by its name, having no value) and a platform default',
		async () => {
			await update({ taskPriorityId: PRIORITY_SHARED });
			expect(await taskRow()).toMatchObject({ priority: 'Shared', taskPriorityId: PRIORITY_SHARED });

			await update({ taskPriorityId: PRIORITY_DEFAULT });
			expect(await taskRow()).toMatchObject({
				priority: TaskPriorityEnum.URGENT,
				taskPriorityId: PRIORITY_DEFAULT
			});
		},
		TIMEOUT
	);

	it(
		'takes a record named by its relation, and names it from the record too',
		async () => {
			await update({ taskPriority: { id: PRIORITY_OWN } });

			expect(await taskRow()).toMatchObject({ priority: 'p0', taskPriorityId: PRIORITY_OWN });
		},
		TIMEOUT
	);

	it(
		'keeps a name sent beside its record as it was sent',
		async () => {
			await update({ taskPriorityId: PRIORITY_OWN, priority: 'P-zero' });

			expect(await taskRow()).toMatchObject({ priority: 'P-zero', taskPriorityId: PRIORITY_OWN });
		},
		TIMEOUT
	);

	it(
		'writes a name sent alone as before, and leaves the record the task holds',
		async () => {
			await update({ taskPriorityId: PRIORITY_OWN });
			await update({ priority: TaskPriorityEnum.HIGH, size: 'large' });

			expect(await taskRow()).toMatchObject({
				priority: TaskPriorityEnum.HIGH,
				taskPriorityId: PRIORITY_OWN,
				size: 'large',
				taskSizeId: null
			});
		},
		TIMEOUT
	);

	it(
		'names a status by its record without touching the status text, as before',
		async () => {
			await update({ taskStatusId: STATUS_OWN });

			expect(await taskRow()).toMatchObject({ status: 'open', taskStatusId: STATUS_OWN });
		},
		TIMEOUT
	);

	it(
		'clears a priority’s record with null and leaves its name',
		async () => {
			await update({ taskPriorityId: PRIORITY_OWN });
			await update({ taskPriorityId: null });

			expect(await taskRow()).toMatchObject({ priority: 'p0', taskPriorityId: null });
		},
		TIMEOUT
	);

	it(
		'saves the whole task sent back with the records it already holds, even one written before the check',
		async () => {
			// A task that holds another organization's priority, as an update could store before.
			await dataSource
				.getRepository(Task)
				.update({ id: TASK }, { taskPriorityId: PRIORITY_OTHER_ORGANIZATION, priority: 'theirs' } as never);

			await update({
				title: 'Renamed',
				priority: 'theirs',
				taskPriorityId: PRIORITY_OTHER_ORGANIZATION,
				taskPriority: { id: PRIORITY_OTHER_ORGANIZATION, name: 'Theirs', value: 'theirs' }
			});

			expect(await taskRow()).toMatchObject({
				title: 'Renamed',
				priority: 'theirs',
				taskPriorityId: PRIORITY_OTHER_ORGANIZATION
			});
		},
		TIMEOUT
	);

	it(
		'saves a new record sent beside a cleared relation when the task holds none, and clears it beside the held one',
		async () => {
			await update({ taskPriority: null, taskPriorityId: PRIORITY_OWN });
			expect(await taskRow()).toMatchObject({ priority: 'p0', taskPriorityId: PRIORITY_OWN });

			await update({ title: 'Renamed', taskPriority: null, taskPriorityId: PRIORITY_OWN });
			expect(await taskRow()).toMatchObject({ title: 'Renamed', priority: 'p0', taskPriorityId: null });
		},
		TIMEOUT
	);

	it(
		'judges no record a task keeps when the update names no organization, the task having none',
		async () => {
			// A task without an organization that holds a record (written before the check): it is not moving anywhere.
			await dataSource
				.getRepository(Task)
				.update({ id: TASK }, { organizationId: null, taskPriorityId: PRIORITY_OWN, priority: 'p0' } as never);

			await service.update(TASK, { title: 'Renamed' } as Partial<ITaskUpdateInput>);

			expect(await taskRow()).toMatchObject({ title: 'Renamed', priority: 'p0', taskPriorityId: PRIORITY_OWN });
		},
		TIMEOUT
	);

	it(
		'judges the records a task keeps against the organization it moves to',
		async () => {
			await update({ taskPriorityId: PRIORITY_OWN });

			await expect(
				service.update(TASK, {
					organizationId: OTHER_ORGANIZATION,
					title: 'Moved'
				} as Partial<ITaskUpdateInput>)
			).rejects.toThrow('TASK_PRIORITY_NOT_FOUND');

			expect(await taskRow()).toMatchObject({ title: 'One', priority: 'p0', taskPriorityId: PRIORITY_OWN });
		},
		TIMEOUT
	);

	it(
		'judges the records against the organization the task moves to, named by its relation',
		async () => {
			// The task's own organization's priority, sent with the task moving to the other organization.
			await expect(
				service.update(TASK, {
					organization: { id: OTHER_ORGANIZATION },
					taskPriorityId: PRIORITY_OWN
				} as unknown as Partial<ITaskUpdateInput>)
			).rejects.toThrow('TASK_PRIORITY_NOT_FOUND');

			expect(await taskRow()).toMatchObject(AS_INSERTED);
		},
		TIMEOUT
	);

	it(
		'takes the record id a client sends beside the relation the task held, as the record the task now has',
		async () => {
			await update({ taskPriorityId: PRIORITY_OWN });

			// The whole task sent back: its relation as it was read, the new record and name beside it.
			await update({
				title: 'One',
				priority: TaskPriorityEnum.URGENT,
				taskPriorityId: PRIORITY_DEFAULT,
				taskPriority: { id: PRIORITY_OWN, name: 'P0', value: 'p0' }
			});

			expect(await taskRow()).toMatchObject({
				priority: TaskPriorityEnum.URGENT,
				taskPriorityId: PRIORITY_DEFAULT
			});
		},
		TIMEOUT
	);

	// ---------------------------------------------------------------- a task created with records

	it.each(REFUSED)(
		'refuses to create a task with %s, and writes none',
		async (_case, records, code) => {
			await expect(create(records)).rejects.toThrow(code);

			expect(await createdRows()).toEqual([]);
		},
		TIMEOUT
	);

	it(
		'creates a task with a priority and a size named by their records alone, with the records’ names',
		async () => {
			await create({ taskPriorityId: PRIORITY_OWN, taskSizeId: SIZE_OWN });

			expect(await createdRows()).toMatchObject([
				{ priority: 'p0', taskPriorityId: PRIORITY_OWN, size: 'huge', taskSizeId: SIZE_OWN }
			]);
		},
		TIMEOUT
	);

	it(
		'creates a task with the tenant’s shared priority (named by its name, having no value) or a platform default',
		async () => {
			await create({ taskPriorityId: PRIORITY_SHARED });
			await create({ taskPriorityId: PRIORITY_DEFAULT });

			const rows = await createdRows();
			expect(rows.map(({ priority, taskPriorityId }) => ({ priority, taskPriorityId }))).toEqual(
				expect.arrayContaining([
					{ priority: 'Shared', taskPriorityId: PRIORITY_SHARED },
					{ priority: TaskPriorityEnum.URGENT, taskPriorityId: PRIORITY_DEFAULT }
				])
			);
			expect(rows).toHaveLength(2);
		},
		TIMEOUT
	);

	it(
		'creates a task with a record named by its relation, and names it from the record',
		async () => {
			await create({ taskPriority: { id: PRIORITY_OWN } });

			expect(await createdRows()).toMatchObject([{ priority: 'p0', taskPriorityId: PRIORITY_OWN }]);
		},
		TIMEOUT
	);

	it(
		'creates a task with its organization’s records and the names sent beside them as sent, as an import sends them',
		async () => {
			// What the Jira, Linear, Asana and Trello imports send: the organization's own records found by name, with the
			// names beside them.
			await create({
				status: 'In review',
				taskStatusId: STATUS_OWN,
				priority: 'P-zero',
				taskPriorityId: PRIORITY_OWN
			});

			expect(await createdRows()).toMatchObject([
				{ status: 'In review', taskStatusId: STATUS_OWN, priority: 'P-zero', taskPriorityId: PRIORITY_OWN }
			]);
		},
		TIMEOUT
	);

	it(
		'creates a task with names only as before, and with a status record without touching the status text',
		async () => {
			await create({ priority: TaskPriorityEnum.HIGH, size: 'large' });
			expect(await createdRows()).toMatchObject([
				{ priority: TaskPriorityEnum.HIGH, taskPriorityId: null, size: 'large', taskSizeId: null }
			]);

			await dataSource.getRepository(Task).delete({ title: 'Created' });
			await create({ taskStatusId: STATUS_OWN });
			expect(await createdRows()).toMatchObject([{ status: 'open', taskStatusId: STATUS_OWN }]);
		},
		TIMEOUT
	);

	it(
		'judges the records against the organization the task is created in',
		async () => {
			// The other organization's priority is refused in this one, and this one's in the other.
			await expect(create({ taskPriorityId: PRIORITY_OTHER_ORGANIZATION })).rejects.toThrow(
				'TASK_PRIORITY_NOT_FOUND'
			);
			await expect(
				service.create({
					tenantId: TENANT,
					organizationId: OTHER_ORGANIZATION,
					title: 'Created',
					taskPriorityId: PRIORITY_OWN
				} as never)
			).rejects.toThrow('TASK_PRIORITY_NOT_FOUND');

			expect(await createdRows()).toEqual([]);
		},
		TIMEOUT
	);
}

(isPostgres() ? describe.skip : describe)(
	'TaskService single update and create with status, priority and size records, on a real SQLite database',
	() => {
		exercise(SQLITE);
	}
);

(isPostgres() && process.env.GAUZY_TASK_SPEC_POSTGRES_URL ? describe : describe.skip)(
	'TaskService single update and create with status, priority and size records, on a real Postgres database',
	() => {
		exercise(POSTGRES);
	}
);
