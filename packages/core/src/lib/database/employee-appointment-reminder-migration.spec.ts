import '../core/entities/internal';

import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import {
	Employee,
	EmployeeAppointment,
	EmployeeAppointmentReminder,
	Organization,
	Tenant,
	User
} from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { CreateEmployeeAppointmentReminderTable1791000012250 } from './migrations/1791000012250-CreateEmployeeAppointmentReminderTable';

/**
 * `1791000012250-CreateEmployeeAppointmentReminderTable` run on a real database: the schema every other entity gives is built
 * first (TypeORM's synchronize), the table is dropped, and the migration creates it again. The table it creates must
 * be the one the entity declares (TypeORM's schema diff finds nothing to change), `up` twice must be harmless, the
 * unique key must refuse a second reminder of one meeting, employee, level and start, a reminder must go with its
 * meeting and with its employee, and
 * `down` must drop it.
 *
 * SQLite runs by default. Postgres runs when the entities are mapped for it and a database is given:
 *
 *   DB_TYPE=postgres GAUZY_MIGRATION_TEST_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 *
 * The Postgres database should be empty and throwaway: the spec builds the whole schema in it.
 */

const TIMEOUT = 15 * 60 * 1000;
const TABLE = 'employee_appointment_reminder';

const TENANT = '84000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '84000000-0000-4000-8000-0000000000a1';
const USER = '84000000-0000-4000-8000-0000000000b1';
const EMPLOYEE = '84000000-0000-4000-8000-0000000000c1';
const OTHER_EMPLOYEE = '84000000-0000-4000-8000-0000000000c2';
const MEETING = '84000000-0000-4000-8000-000000000001';

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/uuid/.test(name)) return '84000000-0000-4000-8000-0000000000ff';
	if (/int|number|numeric|decimal|real|float|double/.test(name)) return 0;
	if (/bool/.test(name)) return false;
	if (/date|time/.test(name)) return new Date('2026-01-01T00:00:00Z');
	if (/json/.test(name)) return {};
	return 'x';
}

/** Inserts a row with the columns given and a placeholder in every other NOT NULL column without a default. */
async function insertRow(
	dataSource: DataSource,
	entity: EntityTarget<ObjectLiteral>,
	row: Record<string, unknown>
): Promise<void> {
	const metadata = dataSource.getMetadata(entity);
	const values: Record<string, unknown> = { ...row };
	for (const column of metadata.columns) {
		const needsNoValue =
			column.isNullable ||
			column.default !== undefined ||
			column.isGenerated ||
			column.isCreateDate ||
			column.isUpdateDate ||
			column.isVirtual ||
			!!column.relationMetadata;
		if (column.propertyName in values || needsNoValue) continue;
		values[column.propertyName] = placeholder(column.type);
	}
	await dataSource.createQueryBuilder().insert().into(entity).values(values).execute();
}

/** Whether the table exists, read on a query runner of its own that is released again. */
async function hasTable(dataSource: DataSource): Promise<boolean> {
	const queryRunner = dataSource.createQueryRunner();
	try {
		return await queryRunner.hasTable(TABLE);
	} finally {
		await queryRunner.release();
	}
}

/** The statements TypeORM would still run to make the table match the entity: none, when the migration made it. */
async function driftOf(dataSource: DataSource): Promise<string[]> {
	const log = await dataSource.driver.createSchemaBuilder().log();
	return log.upQueries.map((query) => query.query).filter((query) => query.includes(TABLE));
}

function exercise(options: () => DataSourceOptions) {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({
			...options(),
			entities: coreEntities,
			synchronize: true,
			logging: false
		} as DataSourceOptions);
		await dataSource.initialize();
		await dataSource.query(`DROP TABLE "${TABLE}"`);
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	const migration = new CreateEmployeeAppointmentReminderTable1791000012250();

	const up = async (inTransaction: boolean) => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			if (inTransaction) await queryRunner.startTransaction();
			await migration.up(queryRunner);
			if (inTransaction) await queryRunner.commitTransaction();
		} catch (error) {
			if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
			throw error;
		} finally {
			await queryRunner.release();
		}
	};

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it(
		'creates the table the entity declares, and running it again changes nothing',
		async () => {
			expect(await hasTable(dataSource)).toBe(false);

			await up(true);

			expect(await hasTable(dataSource)).toBe(true);
			expect(await driftOf(dataSource)).toEqual([]);

			await up(true);
			await up(false);
			expect(await driftOf(dataSource)).toEqual([]);
		},
		TIMEOUT
	);

	it(
		'lets one reminder of a meeting, employee, level and start through, and lets the reminders go with their meeting and employee',
		async () => {
			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await insertRow(dataSource, Tenant, { id: TENANT, name: 'Tenant' });
			await insertRow(dataSource, Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insertRow(dataSource, User, { id: USER, tenantId: TENANT });
			for (const id of [EMPLOYEE, OTHER_EMPLOYEE]) {
				await insertRow(dataSource, Employee, { ...scope, id, userId: USER });
			}
			await insertRow(dataSource, EmployeeAppointment, {
				...scope,
				id: MEETING,
				employeeId: EMPLOYEE,
				agenda: 'Sprint review',
				startDateTime: new Date('2026-11-12T13:00:00Z'),
				endDateTime: new Date('2026-11-12T13:30:00Z')
			});

			const reminders = dataSource.getRepository(EmployeeAppointmentReminder);
			const claimOf = (level: number, employeeId = EMPLOYEE, startDateTime = new Date('2026-11-12T13:00:00Z')) => ({
				...scope,
				employeeAppointmentId: MEETING,
				employeeId,
				level,
				startDateTime,
				employeeNotificationId: '84000000-0000-4000-8000-0000000000d1',
				claimedAt: new Date()
			});
			await reminders.insert(claimOf(1));

			const second = await reminders.insert(claimOf(1)).then(
				() => null,
				(error: unknown) => error
			);
			expect(isUniqueViolation(second)).toBe(true);

			// The next level, another employee, and the same level of a meeting moved since
			await reminders.insert(claimOf(2));
			await reminders.insert(claimOf(1, OTHER_EMPLOYEE));
			await reminders.insert(claimOf(1, EMPLOYEE, new Date('2026-11-12T15:00:00Z')));
			expect(await reminders.count({ where: { employeeAppointmentId: MEETING } })).toBe(4);

			await dataSource.createQueryBuilder().delete().from(Employee).where({ id: OTHER_EMPLOYEE }).execute();
			expect(await reminders.count({ where: { employeeAppointmentId: MEETING } })).toBe(3);

			await dataSource.createQueryBuilder().delete().from(EmployeeAppointment).where({ id: MEETING }).execute();
			expect(await reminders.count({ where: { employeeAppointmentId: MEETING }, withDeleted: true })).toBe(0);
		},
		TIMEOUT
	);

	it(
		'drops the table on down',
		async () => {
			const queryRunner = dataSource.createQueryRunner();
			try {
				await migration.down(queryRunner);
				expect(await queryRunner.hasTable(TABLE)).toBe(false);
				// And up after down builds it again.
				await migration.up(queryRunner);
				expect(await queryRunner.hasTable(TABLE)).toBe(true);
			} finally {
				await queryRunner.release();
			}
			expect(await driftOf(dataSource)).toEqual([]);
		},
		TIMEOUT
	);
}

const postgresUrl = process.env.GAUZY_MIGRATION_TEST_POSTGRES_URL;

(isPostgres() ? describe.skip : describe)('CreateEmployeeAppointmentReminderTable1791000012250 on SQLite', () => {
	exercise(() => ({ type: 'better-sqlite3', database: ':memory:' }));
});

(isPostgres() && postgresUrl ? describe : describe.skip)('CreateEmployeeAppointmentReminderTable1791000012250 on Postgres', () => {
	exercise(() => ({ type: 'postgres', url: postgresUrl }));
});

describe('CreateEmployeeAppointmentReminderTable1791000012250 statements', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('takes the advisory lock in the migration transaction on Postgres, adds the unique key, and skips a foreign key that exists', async () => {
		const statements: Array<{ sql: string; params?: unknown[] }> = [];
		const queryRunner = {
			isTransactionActive: true,
			connection: { options: { type: 'postgres' } },
			query: jest.fn(async (sql: string, params?: unknown[]) => {
				statements.push({ sql, params });
				// Every foreign key exists but the one on the meeting.
				if (sql.startsWith('SELECT 1 FROM pg_constraint'))
					return params?.[0] === 'FK_2216d6675b9b7058392a63cca85' ? [] : [{}];
				return [];
			})
		};

		await new CreateEmployeeAppointmentReminderTable1791000012250().up(queryRunner as never);

		expect(statements[0]).toEqual({ sql: 'SELECT pg_advisory_xact_lock($1)', params: [1791000012250] });
		expect(statements[1].sql).toMatch(/^CREATE TABLE IF NOT EXISTS "employee_appointment_reminder"/);
		expect(statements.map(({ sql }) => sql)).toContain(
			'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_employee_appointment_reminder_key" ON "employee_appointment_reminder" ("employeeAppointmentId", "employeeId", "level", "startDateTime")'
		);
		const added = statements.filter(({ sql }) => sql.startsWith('ALTER TABLE'));
		expect(added).toHaveLength(1);
		expect(added[0].sql).toContain('FOREIGN KEY ("employeeAppointmentId") REFERENCES "employee_appointment"("id") ON DELETE CASCADE');
	});

	it('creates the table with its unique key under a named lock on MySQL', async () => {
		const statements: string[] = [];
		const queryRunner = {
			isTransactionActive: false,
			connection: { options: { type: 'mysql' } },
			getTable: jest.fn(async () => ({ foreignKeys: [] })),
			query: jest.fn(async (sql: string) => {
				statements.push(sql);
				if (sql.startsWith('SELECT GET_LOCK')) return [{ acquired: 1 }];
				return [];
			})
		};

		await new CreateEmployeeAppointmentReminderTable1791000012250().up(queryRunner as never);

		expect(statements[0]).toBe('SELECT GET_LOCK(?, 30) AS acquired');
		expect(statements[1]).toMatch(/^CREATE TABLE IF NOT EXISTS `employee_appointment_reminder`/);
		expect(statements[1]).toContain(
			'UNIQUE INDEX `IDX_employee_appointment_reminder_key` (`employeeAppointmentId`, `employeeId`, `level`, `startDateTime`)'
		);
		expect(statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toHaveLength(7);
		expect(statements[statements.length - 1]).toBe('SELECT RELEASE_LOCK(?)');
	});

	it('refuses a database it does not know before any statement', async () => {
		const queryRunner = { connection: { options: { type: 'oracle' } }, query: jest.fn() };

		await expect(new CreateEmployeeAppointmentReminderTable1791000012250().up(queryRunner as never)).rejects.toThrow(
			'Unsupported database'
		);
		expect(queryRunner.query).not.toHaveBeenCalled();
	});
});
