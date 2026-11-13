import '../core/entities/internal';

import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { Tenant, User, UserTwoFactor } from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { AddTwoFactorAuthentication1791000009900 } from './migrations/1791000009900-AddTwoFactorAuthentication';

/**
 * `1791000009900-AddTwoFactorAuthentication` run on a real database: the schema every other entity gives is built
 * first (TypeORM's synchronize), the table is dropped, and the migration creates it again. The table it creates must
 * be the one the entity declares (TypeORM's schema diff finds nothing to change), `up` twice must be harmless, a user
 * has one row at most, the row goes with its user, and `down` then `up` again leave the same table.
 *
 * SQLite runs by default. Postgres and MySQL run when the entities are mapped for them and a database is given:
 *
 *   DB_TYPE=postgres GAUZY_MIGRATION_TEST_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 *   DB_TYPE=mysql GAUZY_MIGRATION_TEST_MYSQL_URL=mysql://user:password@host:port/empty_database ...
 *
 * The database should be empty and throwaway: the spec builds the whole schema in it.
 */

const TIMEOUT = 15 * 60 * 1000;
const TABLE = 'user_two_factor';

const TENANT = '99000000-0000-4000-8000-00000000000a';
const USER = '99000000-0000-4000-8000-0000000000b1';

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/uuid/.test(name)) return '99000000-0000-4000-8000-0000000000ff';
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
		const queryRunner = dataSource.createQueryRunner();
		try {
			await queryRunner.dropTable(TABLE);
		} finally {
			await queryRunner.release();
		}
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	const migration = new AddTwoFactorAuthentication1791000009900();

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
		'keeps one row per user, and lets the row go with its user',
		async () => {
			await insertRow(dataSource, Tenant, { id: TENANT, name: 'Tenant' });
			await insertRow(dataSource, User, { id: USER, tenantId: TENANT });

			const rows = dataSource.getRepository(UserTwoFactor);
			await rows.insert({ tenantId: TENANT, userId: USER, secret: 'sealed', lastUsedTimeStep: 0 });

			const second = await rows.insert({ tenantId: TENANT, userId: USER, secret: 'other' }).then(
				() => null,
				(error: unknown) => error
			);
			expect(isUniqueViolation(second)).toBe(true);

			const stored = await rows.findOneByOrFail({ userId: USER });
			expect(stored.lastUsedTimeStep).toBe(0);
			expect(stored.enabledAt).toBeNull();

			await dataSource.createQueryBuilder().delete().from(User).where({ id: USER }).execute();

			expect(await rows.count({ where: { userId: USER }, withDeleted: true })).toBe(0);
		},
		TIMEOUT
	);

	it(
		'drops the table on down, and builds the same one on up again',
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
const isSqlite = !isPostgres() && !isMySQL();

(isSqlite ? describe : describe.skip)('AddTwoFactorAuthentication1791000009900 on SQLite', () => {
	exercise(() => ({ type: 'better-sqlite3', database: ':memory:' }));
});

(isPostgres() && postgresUrl ? describe : describe.skip)('AddTwoFactorAuthentication1791000009900 on Postgres', () => {
	exercise(() => ({ type: 'postgres', url: postgresUrl }));
});

(isMySQL() && mysqlUrl ? describe : describe.skip)('AddTwoFactorAuthentication1791000009900 on MySQL', () => {
	exercise(() => ({ type: 'mysql', url: mysqlUrl }));
});
