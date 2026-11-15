import '../core/entities/internal';

import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { Invoice, InvoiceReminder, Organization, Tenant } from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { CreateInvoiceReminderTable1791000011920 } from './migrations/1791000011920-CreateInvoiceReminderTable';

/**
 * `1791000011920-CreateInvoiceReminderTable` run on a real database: the schema every other entity gives is built
 * first (TypeORM's synchronize), the table is dropped, and the migration creates it again. The table it creates must
 * be the one the entity declares (TypeORM's schema diff finds nothing to change), `up` twice must be harmless, the
 * unique key must refuse a second reminder of one invoice, step and due date, a reminder must go with its invoice, and
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
const TABLE = 'invoice_reminder';

const TENANT = '83000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '83000000-0000-4000-8000-0000000000a1';
const INVOICE = '83000000-0000-4000-8000-000000000001';

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/uuid/.test(name)) return '83000000-0000-4000-8000-0000000000ff';
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

	const migration = new CreateInvoiceReminderTable1791000011920();

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
		'lets one reminder of an invoice, step and due date through, and lets the reminders go with their invoice',
		async () => {
			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await insertRow(dataSource, Tenant, { id: TENANT, name: 'Tenant' });
			await insertRow(dataSource, Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insertRow(dataSource, Invoice, {
				...scope,
				id: INVOICE,
				fromOrganizationId: ORGANIZATION,
				invoiceNumber: 1,
				dueDate: new Date('2026-11-30T00:00:00Z'),
				currency: 'USD',
				status: 'SENT'
			});

			const reminders = dataSource.getRepository(InvoiceReminder);
			const claimOf = (step: number, dueDate = new Date('2026-11-30T00:00:00Z')) => ({
				...scope,
				invoiceId: INVOICE,
				step,
				dueDate,
				email: 'billing@acme.test',
				claimedAt: new Date()
			});
			await reminders.insert(claimOf(2));

			const second = await reminders.insert(claimOf(2)).then(
				() => null,
				(error: unknown) => error
			);
			expect(isUniqueViolation(second)).toBe(true);

			// The next step, and the same step of a due date moved since
			await reminders.insert(claimOf(3));
			await reminders.insert(claimOf(2, new Date('2026-12-07T00:00:00Z')));
			expect(
				(await reminders.find({ where: { invoiceId: INVOICE }, order: { step: 'ASC' } })).map(
					({ step }) => step
				)
			).toEqual([2, 2, 3]);

			await dataSource.createQueryBuilder().delete().from(Invoice).where({ id: INVOICE }).execute();

			expect(await reminders.count({ where: { invoiceId: INVOICE }, withDeleted: true })).toBe(0);
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

(isPostgres() ? describe.skip : describe)('CreateInvoiceReminderTable1791000011920 on SQLite', () => {
	exercise(() => ({ type: 'better-sqlite3', database: ':memory:' }));
});

(isPostgres() && postgresUrl ? describe : describe.skip)('CreateInvoiceReminderTable1791000011920 on Postgres', () => {
	exercise(() => ({ type: 'postgres', url: postgresUrl }));
});

describe('CreateInvoiceReminderTable1791000011920 statements', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('takes the advisory lock in the migration transaction on Postgres, adds the unique key, and skips a foreign key that exists', async () => {
		const statements: Array<{ sql: string; params?: unknown[] }> = [];
		const queryRunner = {
			isTransactionActive: true,
			connection: { options: { type: 'postgres' } },
			query: jest.fn(async (sql: string, params?: unknown[]) => {
				statements.push({ sql, params });
				// Every foreign key exists but the one on the invoice.
				if (sql.startsWith('SELECT 1 FROM pg_constraint'))
					return params?.[0] === 'FK_9f80c71996dd6b18445eb10c734' ? [] : [{}];
				return [];
			})
		};

		await new CreateInvoiceReminderTable1791000011920().up(queryRunner as never);

		expect(statements[0]).toEqual({ sql: 'SELECT pg_advisory_xact_lock($1)', params: [1791000011920] });
		expect(statements[1].sql).toMatch(/^CREATE TABLE IF NOT EXISTS "invoice_reminder"/);
		expect(statements.map(({ sql }) => sql)).toContain(
			'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_invoice_reminder_invoice_step_due_date" ON "invoice_reminder" ("invoiceId", "step", "dueDate")'
		);
		const added = statements.filter(({ sql }) => sql.startsWith('ALTER TABLE'));
		expect(added).toHaveLength(1);
		expect(added[0].sql).toContain('FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE');
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

		await new CreateInvoiceReminderTable1791000011920().up(queryRunner as never);

		expect(statements[0]).toBe('SELECT GET_LOCK(?, 30) AS acquired');
		expect(statements[1]).toMatch(/^CREATE TABLE IF NOT EXISTS `invoice_reminder`/);
		expect(statements[1]).toContain(
			'UNIQUE INDEX `IDX_invoice_reminder_invoice_step_due_date` (`invoiceId`, `step`, `dueDate`)'
		);
		expect(statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toHaveLength(6);
		expect(statements[statements.length - 1]).toBe('SELECT RELEASE_LOCK(?)');
	});

	it('refuses a database it does not know before any statement', async () => {
		const queryRunner = { connection: { options: { type: 'oracle' } }, query: jest.fn() };

		await expect(new CreateInvoiceReminderTable1791000011920().up(queryRunner as never)).rejects.toThrow(
			'Unsupported database'
		);
		expect(queryRunner.query).not.toHaveBeenCalled();
	});
});
