import '../core/entities/internal';

import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import {
	Invoice,
	InvoiceSchedule,
	InvoiceScheduleRun,
	Organization,
	OrganizationContact,
	Tenant,
	User
} from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { CreateInvoiceScheduleTables1791000012170 } from './migrations/1791000012170-CreateInvoiceScheduleTables';

/**
 * `1791000012170-CreateInvoiceScheduleTables` run on a real database: the schema every other entity gives is built
 * first (TypeORM's synchronize), the two tables are dropped, and the migration creates them again. The tables it
 * creates must be the ones the entities declare (TypeORM's schema diff finds nothing to change), `up` twice must be
 * harmless, a client must have one schedule at most and a schedule one run per period, the deletes must cascade as the
 * entities say, and `down` must drop both.
 *
 * SQLite runs by default. Postgres runs when the entities are mapped for it and a database is given:
 *
 *   DB_TYPE=postgres GAUZY_MIGRATION_TEST_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 *
 * The Postgres database should be empty and throwaway: the spec builds the whole schema in it.
 */

const TIMEOUT = 15 * 60 * 1000;
const TABLES = ['invoice_schedule', 'invoice_schedule_run'];

const TENANT = '84000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '84000000-0000-4000-8000-0000000000a1';
const CLIENT = '84000000-0000-4000-8000-0000000000c1';
const OTHER_CLIENT = '84000000-0000-4000-8000-0000000000c2';
const AUTHOR = '84000000-0000-4000-8000-0000000000e1';
const INVOICE = '84000000-0000-4000-8000-000000000001';
const SCHEDULE = '84000000-0000-4000-8000-0000000000f1';

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

/** Which of the two tables exist, read on a query runner of its own that is released again. */
async function existingTables(dataSource: DataSource): Promise<string[]> {
	const queryRunner = dataSource.createQueryRunner();
	try {
		const found: string[] = [];
		for (const table of TABLES) {
			if (await queryRunner.hasTable(table)) found.push(table);
		}
		return found;
	} finally {
		await queryRunner.release();
	}
}

/** The statements TypeORM would still run to make the tables match the entities: none, when the migration made them. */
async function driftOf(dataSource: DataSource): Promise<string[]> {
	const log = await dataSource.driver.createSchemaBuilder().log();
	return log.upQueries
		.map((query) => query.query)
		.filter((query) => TABLES.some((table) => query.includes(`"${table}"`) || query.includes(`\`${table}\``)));
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
		await dataSource.query(`DROP TABLE "invoice_schedule_run"`);
		await dataSource.query(`DROP TABLE "invoice_schedule"`);
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	const migration = new CreateInvoiceScheduleTables1791000012170();

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
		'creates the tables the entities declare, and running it again changes nothing',
		async () => {
			expect(await existingTables(dataSource)).toEqual([]);

			await up(true);

			expect(await existingTables(dataSource)).toEqual(TABLES);
			expect(await driftOf(dataSource)).toEqual([]);

			await up(true);
			await up(false);
			expect(await driftOf(dataSource)).toEqual([]);
		},
		TIMEOUT
	);

	it(
		'keeps one schedule per client and one run per period, and deletes as the entities say',
		async () => {
			// The tables, whether or not the test before made them: `up` is harmless when they exist
			await up(false);
			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await insertRow(dataSource, Tenant, { id: TENANT, name: 'Tenant' });
			await insertRow(dataSource, Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insertRow(dataSource, User, { id: AUTHOR, tenantId: TENANT, email: 'author@acme.test' });
			for (const id of [CLIENT, OTHER_CLIENT]) {
				await insertRow(dataSource, OrganizationContact, { ...scope, id, name: `Client ${id.slice(-1)}` });
			}
			await insertRow(dataSource, Invoice, {
				...scope,
				id: INVOICE,
				fromOrganizationId: ORGANIZATION,
				invoiceNumber: 1,
				dueDate: new Date('2026-11-30T00:00:00Z'),
				currency: 'USD',
				status: 'DRAFT'
			});

			const schedules = dataSource.getRepository(InvoiceSchedule);
			const scheduleOf = (organizationContactId: string, id?: string) => ({
				...scope,
				...(id ? { id } : {}),
				organizationContactId,
				frequency: 'MONTHLY',
				startDay: '2026-10-01',
				activeSince: new Date(),
				authorId: AUTHOR
			});
			await schedules.insert(scheduleOf(CLIENT, SCHEDULE) as never);

			const second = await schedules.insert(scheduleOf(CLIENT) as never).then(
				() => null,
				(error: unknown) => error
			);
			expect(isUniqueViolation(second)).toBe(true);
			await schedules.insert(scheduleOf(OTHER_CLIENT) as never);

			const stored = await schedules.findOneByOrFail({ id: SCHEDULE });
			expect(stored).toMatchObject({ grouping: 'PROJECT', sendInvoice: false, pausedAt: null });

			const runs = dataSource.getRepository(InvoiceScheduleRun);
			const runOf = (periodStart: string, periodEnd: string) => ({
				...scope,
				invoiceScheduleId: SCHEDULE,
				periodStart,
				periodEnd,
				status: 'CLAIMED',
				claimedAt: new Date()
			});
			await runs.insert({ ...runOf('2026-10-01', '2026-10-31'), invoiceId: INVOICE } as never);
			const again = await runs.insert(runOf('2026-10-01', '2026-10-31') as never).then(
				() => null,
				(error: unknown) => error
			);
			expect(isUniqueViolation(again)).toBe(true);
			await runs.insert(runOf('2026-11-01', '2026-11-30') as never);

			// A deleted invoice leaves its run, without the link
			await dataSource.createQueryBuilder().delete().from(Invoice).where({ id: INVOICE }).execute();
			const kept = await runs.findOneByOrFail({ invoiceScheduleId: SCHEDULE, periodStart: '2026-10-01' });
			expect(kept.invoiceId).toBeNull();

			// A deleted author leaves the schedule, without one
			await dataSource.createQueryBuilder().delete().from(User).where({ id: AUTHOR }).execute();
			expect((await schedules.findOneByOrFail({ id: SCHEDULE })).authorId).toBeNull();

			// A deleted client takes its schedule and the schedule's runs with it
			await dataSource.createQueryBuilder().delete().from(OrganizationContact).where({ id: CLIENT }).execute();
			expect(await schedules.countBy({ organizationContactId: CLIENT })).toBe(0);
			expect(await runs.countBy({ invoiceScheduleId: SCHEDULE })).toBe(0);
			expect(await schedules.countBy({ organizationContactId: OTHER_CLIENT })).toBe(1);
		},
		TIMEOUT
	);

	it(
		'drops the tables on down, and builds them again on up',
		async () => {
			const queryRunner = dataSource.createQueryRunner();
			try {
				await migration.down(queryRunner);
			} finally {
				await queryRunner.release();
			}
			expect(await existingTables(dataSource)).toEqual([]);

			await up(false);
			expect(await existingTables(dataSource)).toEqual(TABLES);
			expect(await driftOf(dataSource)).toEqual([]);
		},
		TIMEOUT
	);
}

const postgresUrl = process.env.GAUZY_MIGRATION_TEST_POSTGRES_URL;

(isPostgres() ? describe.skip : describe)('CreateInvoiceScheduleTables1791000012170 on SQLite', () => {
	exercise(() => ({ type: 'better-sqlite3', database: ':memory:' }));
});

(isPostgres() && postgresUrl ? describe : describe.skip)('CreateInvoiceScheduleTables1791000012170 on Postgres', () => {
	exercise(() => ({ type: 'postgres', url: postgresUrl }));
});

describe('CreateInvoiceScheduleTables1791000012170 statements', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('takes the advisory lock in the migration transaction on Postgres, adds both unique keys, and skips a foreign key that exists', async () => {
		const statements: Array<{ sql: string; params?: unknown[] }> = [];
		const queryRunner = {
			isTransactionActive: true,
			connection: { options: { type: 'postgres' } },
			query: jest.fn(async (sql: string, params?: unknown[]) => {
				statements.push({ sql, params });
				// Every foreign key exists but the run's to its schedule.
				if (sql.startsWith('SELECT 1 FROM pg_constraint'))
					return params?.[0] === 'FK_246bf55161b1997c4f01f3bbb03' ? [] : [{}];
				return [];
			})
		};

		await new CreateInvoiceScheduleTables1791000012170().up(queryRunner as never);

		expect(statements[0]).toEqual({ sql: 'SELECT pg_advisory_xact_lock($1)', params: [1791000012170] });
		expect(statements[1].sql).toMatch(/^CREATE TABLE IF NOT EXISTS "invoice_schedule" /);
		const sql = statements.map(({ sql }) => sql);
		expect(sql).toContain(
			'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_schedule_organization_contact" ON "invoice_schedule" ("organizationContactId")'
		);
		expect(sql).toContain(
			'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_schedule_run_schedule_period" ON "invoice_schedule_run" ("invoiceScheduleId", "periodStart")'
		);
		const added = statements.filter(({ sql }) => sql.startsWith('ALTER TABLE'));
		expect(added).toHaveLength(1);
		expect(added[0].sql).toContain(
			'FOREIGN KEY ("invoiceScheduleId") REFERENCES "invoice_schedule"("id") ON DELETE CASCADE'
		);
	});

	it('creates both tables with their unique keys under a named lock on MySQL', async () => {
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

		await new CreateInvoiceScheduleTables1791000012170().up(queryRunner as never);

		expect(statements[0]).toBe('SELECT GET_LOCK(?, 30) AS acquired');
		const creates = statements.filter((sql) => sql.startsWith('CREATE TABLE IF NOT EXISTS'));
		expect(creates[0]).toMatch(/^CREATE TABLE IF NOT EXISTS `invoice_schedule` /);
		expect(creates[0]).toContain(
			'UNIQUE INDEX `IDX_invoice_schedule_organization_contact` (`organizationContactId`)'
		);
		expect(creates[1]).toMatch(/^CREATE TABLE IF NOT EXISTS `invoice_schedule_run` /);
		expect(creates[1]).toContain(
			'UNIQUE INDEX `IDX_invoice_schedule_run_schedule_period` (`invoiceScheduleId`, `periodStart`)'
		);
		expect(statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toHaveLength(14);
		expect(statements[statements.length - 1]).toBe('SELECT RELEASE_LOCK(?)');
	});

	it('drops the run table before the schedule table on down', async () => {
		const statements: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'postgres' } },
			query: jest.fn(async (sql: string) => {
				statements.push(sql);
				return [];
			})
		};

		await new CreateInvoiceScheduleTables1791000012170().down(queryRunner as never);

		expect(statements).toEqual([
			'DROP TABLE IF EXISTS "invoice_schedule_run"',
			'DROP TABLE IF EXISTS "invoice_schedule"'
		]);
	});

	it('refuses a database it does not know before any statement', async () => {
		const queryRunner = { connection: { options: { type: 'oracle' } }, query: jest.fn() };

		await expect(new CreateInvoiceScheduleTables1791000012170().up(queryRunner as never)).rejects.toThrow(
			'Unsupported database'
		);
		expect(queryRunner.query).not.toHaveBeenCalled();
	});
});
