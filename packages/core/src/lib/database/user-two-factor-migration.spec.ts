import '../core/entities/internal';

import { DataSource, DataSourceOptions } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { Organization, Tenant, User, UserTwoFactor } from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { AddTwoFactorAuthentication1791000009900 } from './migrations/1791000009900-AddTwoFactorAuthentication';
import { insertRow } from './testing/insert-row';

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
const ORGANIZATION = '99000000-0000-4000-8000-0000000000a1';

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

/** An identifier quoted for the database of the data source. */
function quote(dataSource: DataSource, identifier: string): string {
	return dataSource.driver.escape(identifier);
}

/** The statements TypeORM would still run on the organization table: none, when the migration added its column. */
async function organizationDriftOf(dataSource: DataSource): Promise<string[]> {
	const log = await dataSource.driver.createSchemaBuilder().log();
	return log.upQueries.map((query) => query.query).filter((query) => query.includes('requireTwoFactor'));
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
		'adds the organization rule, off for every organization, with nothing left for TypeORM to change',
		async () => {
			// An organization of before the migration: it exists, then the column it does not have yet is taken away.
			await insertRow(dataSource, Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			const queryRunner = dataSource.createQueryRunner();
			try {
				await queryRunner.dropColumn('organization', 'requireTwoFactor');
			} finally {
				await queryRunner.release();
			}

			await up(true);

			const [row] = await dataSource.query(
				`SELECT ${quote(dataSource, 'requireTwoFactor')} AS ${quote(dataSource, 'required')} FROM ${quote(
					dataSource,
					'organization'
				)} WHERE ${quote(dataSource, 'id')} = '${ORGANIZATION}'`
			);
			expect(Boolean(Number(row.required))).toBe(false);
			expect(await organizationDriftOf(dataSource)).toEqual([]);
		},
		TIMEOUT
	);

	it(
		'drops the table on down, and builds the same one on up again',
		async () => {
			const queryRunner = dataSource.createQueryRunner();
			// SQLite keeps an additive column on down, as every migration of the platform does on the embedded dialect.
			const columnStaysOnDown = dataSource.options.type === 'better-sqlite3';
			try {
				await migration.down(queryRunner);
				expect(await queryRunner.hasTable(TABLE)).toBe(false);
				expect(await queryRunner.hasColumn('organization', 'requireTwoFactor')).toBe(columnStaysOnDown);
				await migration.up(queryRunner);
				expect(await queryRunner.hasTable(TABLE)).toBe(true);
				expect(await queryRunner.hasColumn('organization', 'requireTwoFactor')).toBe(true);
			} finally {
				await queryRunner.release();
			}
			expect(await driftOf(dataSource)).toEqual([]);
			expect(await organizationDriftOf(dataSource)).toEqual([]);
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

/**
 * MySQL runs against a minimal fixture of the tables the migration references, not the whole schema: TypeORM's
 * synchronize of every entity does not build on MySQL (an index on a text column of another table). The fixture is
 * enough for every statement of the migration to run for real.
 */
(mysqlUrl ? describe : describe.skip)('AddTwoFactorAuthentication1791000009900 on MySQL (minimal fixture)', () => {
	let dataSource: DataSource;
	const migration = new AddTwoFactorAuthentication1791000009900();

	const columnsOf = async (table: string): Promise<string[]> =>
		(
			await dataSource.query(
				'SELECT `COLUMN_NAME` AS `name` FROM information_schema.COLUMNS WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = ?',
				[table]
			)
		).map((row: { name: string }) => row.name);

	const run = async (step: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[step](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	beforeAll(async () => {
		dataSource = new DataSource({ type: 'mysql', url: mysqlUrl, logging: false });
		await dataSource.initialize();
		for (const table of [TABLE, 'organization', 'user', 'tenant']) {
			await dataSource.query(`DROP TABLE IF EXISTS \`${table}\``);
		}
		await dataSource.query('CREATE TABLE `tenant` (`id` varchar(36) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB');
		await dataSource.query('CREATE TABLE `user` (`id` varchar(36) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB');
		await dataSource.query(
			'CREATE TABLE `organization` (`id` varchar(36) NOT NULL, `name` varchar(255) NOT NULL, PRIMARY KEY (`id`)) ENGINE=InnoDB'
		);
		await dataSource.query('INSERT INTO `organization` (`id`, `name`) VALUES (?, ?)', [ORGANIZATION, 'Organization']);
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it(
		'runs up, down and up again',
		async () => {
			await run('up');
			await run('up');
			expect(await columnsOf(TABLE)).toEqual(expect.arrayContaining(['userId', 'secret', 'recoveryCodes']));
			const [organization] = await dataSource.query('SELECT `requireTwoFactor` AS `required` FROM `organization`');
			expect(Number(organization.required)).toBe(0);

			await run('down');
			expect(await columnsOf(TABLE)).toEqual([]);
			expect(await columnsOf('organization')).not.toContain('requireTwoFactor');

			await run('up');
			expect(await columnsOf(TABLE)).toContain('lastUsedTimeStep');
			expect(await columnsOf('organization')).toContain('requireTwoFactor');
		},
		TIMEOUT
	);
});
