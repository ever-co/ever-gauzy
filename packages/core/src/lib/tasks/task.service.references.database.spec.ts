import '../core/entities/internal';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { coreEntities } from '../core/entities';
import {
	Organization,
	OrganizationProject,
	OrganizationSprintTaskHistory,
	TaskFormerReference,
	Tenant
} from '../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { Task } from './task.entity';
import { TaskService } from './task.service';

/**
 * `TaskService.update` and the references, on a real database with the tables TypeORM creates:
 *
 * - **one transaction per update.** The save, the reference a moved task leaves behind and the read-back of the
 *   sync scope are one unit: when a step fails, the task is stored as it was. A bulk update therefore reports a
 *   task as refused only when the task did not change (plan §7.1 of task-views-and-bulk-actions).
 * - **a moved task keeps its old reference.** `API-42` still resolves to the task after it became `SYS-1`, and
 *   project `API` never hands out 42 again (plan §7.3).
 *
 * SQLite runs by default. Postgres (the production database) runs when the entities are mapped for it and an empty,
 * throwaway database is given (the spec builds the whole schema in it):
 *
 *   DB_TYPE=postgres GAUZY_TASK_SPEC_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 */

const TIMEOUT = 15 * 60 * 1000;

const fixture = createTenantFixture({
	tenantId: '83000000-0000-4000-8000-00000000000a',
	organizationId: '83000000-0000-4000-8000-0000000000a1',
	user: { id: '83000000-0000-4000-8000-0000000000b1' } as IUser
});
const TENANT = fixture.tenantId;
const ORGANIZATION = fixture.organizationId;
const PROJECT_API = '83000000-0000-4000-8000-0000000000c1';
const PROJECT_SYS = '83000000-0000-4000-8000-0000000000c2';
const TASK_42 = '83000000-0000-4000-8000-000000000042';
const TASK_41 = '83000000-0000-4000-8000-000000000041';

/** What the database answers when it refuses a former reference (see `refuseFormerReferenceOf`). */
const REFUSAL = 'disk I/O error while writing the former reference';
const TABLES = ['task_former_reference', 'task', 'organization_project', 'organization', 'tenant'];

/** The database the spec runs on, and what differs between the two. */
interface Dialect {
	options: () => DataSourceOptions;
	/** Empties the tables the spec writes, whatever refers to them. */
	reset: (dataSource: DataSource) => Promise<void>;
	/** Makes the database refuse the former reference of one task (a trigger), or lets it be again (`null`). */
	refuseFormerReferenceOf: (dataSource: DataSource, taskId: string | null) => Promise<void>;
}

const SQLITE: Dialect = {
	options: () => ({
		type: 'better-sqlite3',
		database: path.join(os.tmpdir(), `gauzy-task-references-${process.pid}-${Date.now()}.sqlite3`)
	}),
	reset: async (dataSource) => {
		await dataSource.query('PRAGMA foreign_keys = OFF');
		for (const table of TABLES) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		await dataSource.query('PRAGMA foreign_keys = ON');
	},
	refuseFormerReferenceOf: async (dataSource, taskId) => {
		await dataSource.query('DROP TRIGGER IF EXISTS "refuse_former_reference"');
		if (!taskId) return;
		await dataSource.query(
			`CREATE TRIGGER "refuse_former_reference" BEFORE INSERT ON "task_former_reference" WHEN NEW."taskId" = '${taskId}' BEGIN SELECT RAISE(ABORT, '${REFUSAL}'); END`
		);
	}
};

const POSTGRES: Dialect = {
	options: () => ({ type: 'postgres', url: process.env.GAUZY_TASK_SPEC_POSTGRES_URL }),
	reset: async (dataSource) => {
		await dataSource.query(`TRUNCATE ${TABLES.map((table) => `"${table}"`).join(', ')} CASCADE`);
	},
	refuseFormerReferenceOf: async (dataSource, taskId) => {
		await dataSource.query('DROP TRIGGER IF EXISTS "refuse_former_reference" ON "task_former_reference"');
		if (!taskId) return;
		await dataSource.query(
			`CREATE OR REPLACE FUNCTION "refuse_former_reference"() RETURNS trigger AS $body$ BEGIN IF NEW."taskId" = '${taskId}' THEN RAISE EXCEPTION '${REFUSAL}'; END IF; RETURN NEW; END; $body$ LANGUAGE plpgsql`
		);
		await dataSource.query(
			`CREATE TRIGGER "refuse_former_reference" BEFORE INSERT ON "task_former_reference" FOR EACH ROW EXECUTE FUNCTION "refuse_former_reference"()`
		);
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
			select: { id: true, title: true, projectId: true, number: true, prefix: true, status: true }
		});

	const formerReferences = () =>
		dataSource.getRepository(TaskFormerReference).find({
			select: { id: true, taskId: true, projectId: true, number: true, prefix: true, organizationId: true, tenantId: true },
			order: { number: 'ASC' }
		});

	/**
	 * Makes the database refuse the former reference of the task named: a write the update makes after its save, in
	 * the same transaction (a trigger, so the failure is the database's own, as a full disk or a lost lock would be).
	 */
	const refuseFormerReferenceOf = (taskId: string) => dialect.refuseFormerReferenceOf(dataSource, taskId);

	beforeAll(async () => {
		dataSource = new DataSource({ ...dialect.options(), entities: coreEntities, synchronize: true, logging: false } as DataSourceOptions);
		await dataSource.initialize();
	}, TIMEOUT);

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		await dialect.refuseFormerReferenceOf(dataSource, null);
		const file = (dataSource.options as { database?: unknown }).database;
		await dataSource.destroy();
		if (typeof file === 'string' && file.endsWith('.sqlite3')) fs.rmSync(file, { force: true });
	});

	beforeEach(async () => {
		await dialect.refuseFormerReferenceOf(dataSource, null);
		await dialect.reset(dataSource);
		const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
		await insert(Tenant, { id: TENANT, name: 'Tenant' });
		await insert(Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
		await insert(OrganizationProject, { ...scope, id: PROJECT_API, name: 'Api Gateway', taskKey: 'API' });
		await insert(OrganizationProject, { ...scope, id: PROJECT_SYS, name: 'Systems', taskKey: 'SYS' });
		await insert(Task, { ...scope, id: TASK_41, title: 'Forty-one', projectId: PROJECT_API, number: 41, prefix: 'Api', status: 'open' });
		await insert(Task, { ...scope, id: TASK_42, title: 'Forty-two', projectId: PROJECT_API, number: 42, prefix: 'Api', status: 'open' });

		({ restore } = asTenantUser(fixture, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		// The service as Nest builds it, over the real repositories (its CRUD base keeps caches set by the constructor);
		// the collaborators the update only notifies are stand-ins.
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

	it(
		'renumbers a moved task in its new project and keeps the reference it held, which still resolves',
		async () => {
			await service.update(TASK_42, { projectId: PROJECT_SYS });

			expect(await taskRow(TASK_42)).toMatchObject({ projectId: PROJECT_SYS, number: 1, prefix: 'Sys' });
			expect(await formerReferences()).toEqual([
				expect.objectContaining({
					taskId: TASK_42,
					projectId: PROJECT_API,
					number: 42,
					prefix: 'Api',
					organizationId: ORGANIZATION,
					tenantId: TENANT
				})
			]);

			const [former, live, other, unknown] = await service.resolveReferences({
				organizationId: ORGANIZATION,
				references: ['API-42', 'SYS-1', 'API-41', 'API-43']
			} as never);
			expect(former).toMatchObject({
				resolved: true,
				taskId: TASK_42,
				projectId: PROJECT_SYS,
				formerReference: true,
				currentKey: 'SYS',
				currentNumber: 1
			});
			expect(live).toMatchObject({ resolved: true, taskId: TASK_42, currentKey: 'SYS', currentNumber: 1 });
			expect(live).not.toHaveProperty('formerReference');
			expect(other).toMatchObject({ resolved: true, taskId: TASK_41, currentKey: 'API', currentNumber: 41 });
			expect(unknown).toMatchObject({ resolved: false });
		},
		TIMEOUT
	);

	it(
		'never hands the number of a moved task to another task of the project it left',
		async () => {
			await service.update(TASK_42, { projectId: PROJECT_SYS });

			const where = { tenantId: TENANT, organizationId: ORGANIZATION, projectId: PROJECT_API };
			// What a new task of the project is numbered after: 42 is still API-42, the moved task.
			expect(await service.getMaxTaskNumberByProject(where, { withDeleted: true })).toBe(42);
			// The read routes report the live tasks, as before.
			expect(await service.getMaxTaskNumberByProject(where)).toBe(41);
		},
		TIMEOUT
	);

	it(
		'keeps the reference of a task that leaves its project for none',
		async () => {
			await service.update(TASK_42, { projectId: null });

			expect(await taskRow(TASK_42)).toMatchObject({ projectId: null, number: 42 });
			const [resolution] = await service.resolveReferences({ organizationId: ORGANIZATION, references: ['API-42'] } as never);
			expect(resolution).toMatchObject({ resolved: true, taskId: TASK_42, formerReference: true });
			expect(resolution.currentKey).toBeUndefined();
		},
		TIMEOUT
	);

	it(
		'stores nothing of an update a later step of it failed: the save is undone',
		async () => {
			await refuseFormerReferenceOf(TASK_42);

			await expect(service.update(TASK_42, { title: 'Renamed', projectId: PROJECT_SYS })).rejects.toThrow(REFUSAL);

			expect(await taskRow(TASK_42)).toMatchObject({ title: 'Forty-two', projectId: PROJECT_API, number: 42, prefix: 'Api' });
			expect(await formerReferences()).toEqual([]);
		},
		TIMEOUT
	);

	it(
		'CONTROL: stores the whole update when every step succeeds',
		async () => {
			await service.update(TASK_42, { title: 'Renamed', projectId: PROJECT_SYS });

			expect(await taskRow(TASK_42)).toMatchObject({ title: 'Renamed', projectId: PROJECT_SYS, number: 1 });
			expect(await formerReferences()).toHaveLength(1);
		},
		TIMEOUT
	);

	it(
		'reports a task of a bulk update as refused only when it did not change',
		async () => {
			await refuseFormerReferenceOf(TASK_41);

			const outcome = await service.bulkUpdate(
				{ organizationId: ORGANIZATION, taskIds: [TASK_42, TASK_41], changes: { projectId: PROJECT_SYS } } as never,
				(id, update) => service.update(id, update)
			);

			expect(outcome).toMatchObject({ applied: 1, refused: 1 });
			const byTask = new Map(outcome.results.map((result) => [result.taskId, result]));
			expect(byTask.get(TASK_42)).toMatchObject({ ok: true });
			expect(byTask.get(TASK_41)).toMatchObject({ ok: false, previous: { projectId: PROJECT_API } });

			// The task reported as refused is exactly as it was; the other one moved.
			expect(await taskRow(TASK_41)).toMatchObject({ projectId: PROJECT_API, number: 41, prefix: 'Api' });
			expect(await taskRow(TASK_42)).toMatchObject({ projectId: PROJECT_SYS, number: 1 });
			expect((await formerReferences()).map((row) => row.taskId)).toEqual([TASK_42]);
		},
		TIMEOUT
	);
}

(isPostgres() ? describe.skip : describe)('TaskService updates and references, on a real SQLite database', () => {
	exercise(SQLITE);
});

(isPostgres() && process.env.GAUZY_TASK_SPEC_POSTGRES_URL ? describe : describe.skip)(
	'TaskService updates and references, on a real Postgres database',
	() => {
		exercise(POSTGRES);
	}
);
