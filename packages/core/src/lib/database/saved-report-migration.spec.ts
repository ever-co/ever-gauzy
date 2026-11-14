import '../core/entities/internal';

import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { Organization, SavedReport, Tenant, User } from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { CreateSavedReportTable1791000009600 } from './migrations/1791000009600-CreateSavedReportTable';

/**
 * `1791000009600-CreateSavedReportTable` run on a real database: the schema every other entity gives is built first
 * (TypeORM's synchronize), the table is dropped, and the migration creates it again. The table it creates must be the
 * one the entity declares (TypeORM's schema diff finds nothing to change), `up` twice must be harmless, one link digest
 * must open one report while reports without a link share the null, a report must go with its author, and `down` must
 * drop it.
 *
 * SQLite runs by default. Postgres and MySQL run when the entities are mapped for them and an empty, throwaway database
 * is given (the spec builds the whole schema in it):
 *
 *   DB_TYPE=postgres GAUZY_MIGRATION_TEST_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 *   DB_TYPE=mysql GAUZY_MIGRATION_TEST_MYSQL_URL=mysql://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 */

const TIMEOUT = 15 * 60 * 1000;
const TABLE = 'saved_report';

const TENANT = '96000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '96000000-0000-4000-8000-0000000000a1';
const AUTHOR = '96000000-0000-4000-8000-0000000000b1';
const OTHER_AUTHOR = '96000000-0000-4000-8000-0000000000b2';

/** A column type as text: a constructor by its name. */
function typeNameOf(type: unknown): string {
	if (typeof type === 'function') {
		return type.name.toLowerCase();
	}
	return String(type).toLowerCase();
}

/** `describe` when the condition holds, `describe.skip` otherwise. */
function describeWhen(condition: boolean): jest.Describe {
	if (condition) {
		return describe;
	}
	return describe.skip;
}

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeNameOf(type);
	if (/uuid/.test(name)) return '96000000-0000-4000-8000-0000000000ff';
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
		await dataSource.query(`DROP TABLE ${dataSource.driver.escape(TABLE)}`);
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	const migration = new CreateSavedReportTable1791000009600();

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
		'lets one report open by a digest, lets reports without a link share the null, and lets them go with their author',
		async () => {
			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await insertRow(dataSource, Tenant, { id: TENANT, name: 'Tenant' });
			await insertRow(dataSource, Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insertRow(dataSource, User, { id: AUTHOR, tenantId: TENANT });
			await insertRow(dataSource, User, { id: OTHER_AUTHOR, tenantId: TENANT });

			const reports = dataSource.getRepository(SavedReport);
			const reportOf = (authorId: string, shareTokenHash: string | null) => ({
				...scope,
				authorId,
				name: 'Client A, last month',
				shareTokenHash
			});
			await reports.insert(reportOf(AUTHOR, 'a'.repeat(64)));
			await reports.insert(reportOf(AUTHOR, null));
			await reports.insert(reportOf(OTHER_AUTHOR, null));

			const second = await reports.insert(reportOf(OTHER_AUTHOR, 'a'.repeat(64))).then(
				() => null,
				(error: unknown) => error
			);
			expect(isUniqueViolation(second)).toBe(true);

			const stored = await reports.findOne({ where: { authorId: AUTHOR, shareTokenHash: 'a'.repeat(64) } });
			expect(stored).toMatchObject({ kind: 'TIME_AND_ACTIVITY', includeAmounts: false, filters: null });

			await dataSource.createQueryBuilder().delete().from(User).where({ id: AUTHOR }).execute();

			expect(await reports.count({ where: { authorId: AUTHOR }, withDeleted: true })).toBe(0);
			expect(await reports.count({ where: { authorId: OTHER_AUTHOR } })).toBe(1);
		},
		TIMEOUT
	);

	it(
		'drops the table on down, and up builds it again',
		async () => {
			const queryRunner = dataSource.createQueryRunner();
			try {
				await migration.down(queryRunner);
				expect(await queryRunner.hasTable(TABLE)).toBe(false);
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
const mysqlUrl = process.env.GAUZY_MIGRATION_TEST_MYSQL_URL;
const isServerDialect = isPostgres() || isMySQL();

describeWhen(!isServerDialect)('CreateSavedReportTable1791000009600 on SQLite', () => {
	exercise(() => ({ type: 'better-sqlite3', database: ':memory:' }));
});

describeWhen(isPostgres() && !!postgresUrl)('CreateSavedReportTable1791000009600 on Postgres', () => {
	exercise(() => ({ type: 'postgres', url: postgresUrl }));
});

describeWhen(isMySQL() && !!mysqlUrl)('CreateSavedReportTable1791000009600 on MySQL', () => {
	exercise(() => ({ type: 'mysql', url: mysqlUrl }));
});

describe('CreateSavedReportTable1791000009600 statements', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('takes the advisory lock in the migration transaction on Postgres, adds the unique key, and skips a foreign key that exists', async () => {
		const statements: Array<{ sql: string; params?: unknown[] }> = [];
		const queryRunner = {
			isTransactionActive: true,
			connection: { options: { type: 'postgres' } },
			query: jest.fn(async (sql: string, params?: unknown[]) => {
				statements.push({ sql, params });
				// Every foreign key exists but the one on the author.
				if (sql.startsWith('SELECT 1 FROM pg_constraint'))
					return params?.[0] === 'FK_f795e53cc50d7d7a3e7f6bdd54e' ? [] : [{}];
				return [];
			})
		};

		await new CreateSavedReportTable1791000009600().up(queryRunner as never);

		expect(statements[0]).toEqual({ sql: 'SELECT pg_advisory_xact_lock($1)', params: [1791000009600] });
		expect(statements[1].sql).toMatch(/^CREATE TABLE IF NOT EXISTS "saved_report"/);
		expect(statements.map(({ sql }) => sql)).toContain(
			'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_a80ec2517727b41dbf03a0a294" ON "saved_report" ("shareTokenHash")'
		);
		const added = statements.filter(({ sql }) => sql.startsWith('ALTER TABLE'));
		expect(added).toHaveLength(1);
		expect(added[0].sql).toContain('FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE');
	});

	it('creates the table with its unique key under a named lock on MySQL, and releases the lock', async () => {
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

		await new CreateSavedReportTable1791000009600().up(queryRunner as never);

		expect(statements[0]).toBe('SELECT GET_LOCK(?, 30) AS acquired');
		expect(statements[1]).toMatch(/^CREATE TABLE IF NOT EXISTS `saved_report`/);
		expect(statements[1]).toContain('UNIQUE INDEX `IDX_a80ec2517727b41dbf03a0a294` (`shareTokenHash`)');
		expect(statements[statements.length - 1]).toBe('SELECT RELEASE_LOCK(?)');
	});
});
