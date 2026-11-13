import '../core/entities/internal';

import { DataSource, DataSourceOptions, EntityTarget, ObjectLiteral } from 'typeorm';
import { isMySQL, isPostgres } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { Organization, OrganizationContact, OrganizationProject, Tenant, TimeGoal } from '../core/entities/internal';
import { CreateTimeGoalTables1791000009500 } from './migrations/1791000009500-CreateTimeGoalTables';

/**
 * `1791000009500-CreateTimeGoalTables` run on a real database. The time goal tables must be the tables the entity
 * declares (TypeORM's schema diff finds nothing to change), `up` twice must be harmless, a goal must keep its projects
 * and clients and lose the link when either side goes, and `down` must drop the tables.
 *
 * SQLite runs by default. Postgres and MySQL run when the entities are mapped for them and a database is given:
 *
 *   DB_TYPE=postgres GAUZY_MIGRATION_TEST_POSTGRES_URL=postgres://user:password@host:port/empty_database \
 *     node --experimental-vm-modules node_modules/jest/bin/jest.js -c packages/core/jest.config.ts <this file>
 *   DB_TYPE=mysql GAUZY_MIGRATION_TEST_MYSQL_URL=mysql://user:password@host:port/empty_database ...
 *
 * The database should be empty and throwaway. On SQLite and Postgres the spec builds the whole schema (TypeORM's
 * synchronize) and drops the time goal tables before the migration creates them again. MySQL cannot build the whole
 * schema that way (an older entity indexes a TEXT column), so there the spec creates only the tables the new foreign
 * keys point to.
 */

const TIMEOUT = 15 * 60 * 1000;
const TABLES = ['time_goal', 'time_goal_project', 'time_goal_organization_contact'];
/** The tables the time goal foreign keys point to. */
const REFERENCED_TABLES = [
	'user',
	'tenant',
	'organization',
	'employee',
	'organization_team',
	'organization_project',
	'organization_contact'
];

const TENANT = '95000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '95000000-0000-4000-8000-0000000000a1';
const PROJECT = '95000000-0000-4000-8000-0000000000b1';
const CLIENT = '95000000-0000-4000-8000-0000000000c1';
const GOAL = '95000000-0000-4000-8000-000000000001';

/** How a database is prepared for the migration, and how the rows a goal points to are written into it. */
interface Harness {
	options: () => DataSourceOptions;
	/** Builds what the migration needs before it runs, the time goal tables left out. */
	prepare: (dataSource: DataSource) => Promise<void>;
	/** Writes the tenant, organization, project and client a goal points to. */
	seed: (dataSource: DataSource) => Promise<void>;
}

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/uuid/.test(name)) return '95000000-0000-4000-8000-0000000000ff';
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

/** The whole schema from the entities, without the time goal tables, and full rows for the goal to point to. */
const wholeSchema = (options: () => DataSourceOptions): Harness => ({
	options: () => ({ ...options(), synchronize: true }) as DataSourceOptions,
	prepare: async (dataSource) => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			// The pivots first: they point to the goal table.
			for (const table of [...TABLES].reverse()) {
				await queryRunner.dropTable(table, true);
			}
		} finally {
			await queryRunner.release();
		}
	},
	seed: async (dataSource) => {
		const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
		await insertRow(dataSource, Tenant, { id: TENANT, name: 'Tenant' });
		await insertRow(dataSource, Organization, { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
		await insertRow(dataSource, OrganizationProject, { ...scope, id: PROJECT, name: 'Client A website' });
		await insertRow(dataSource, OrganizationContact, { ...scope, id: CLIENT, name: 'Client A' });
	}
});

/** Only the tables the time goal foreign keys point to, each with its key alone. */
const referencedTablesOnly = (options: () => DataSourceOptions): Harness => ({
	options: () => ({ ...options(), synchronize: false }) as DataSourceOptions,
	prepare: async (dataSource) => {
		for (const table of REFERENCED_TABLES) {
			await dataSource.query(
				`CREATE TABLE \`${table}\` (\`id\` varchar(36) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		}
	},
	seed: async (dataSource) => {
		for (const [table, id] of [
			['tenant', TENANT],
			['organization', ORGANIZATION],
			['organization_project', PROJECT],
			['organization_contact', CLIENT]
		]) {
			await dataSource.query(`INSERT INTO \`${table}\` (\`id\`) VALUES (?)`, [id]);
		}
	}
});

/** Which of the time goal tables exist, read on a query runner of its own that is released again. */
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

/** The statements TypeORM would still run to make the tables match the entity: none, when the migration made them. */
async function driftOf(dataSource: DataSource): Promise<string[]> {
	const log = await dataSource.driver.createSchemaBuilder().log();
	return log.upQueries.map((query) => query.query).filter((query) => query.includes('time_goal'));
}

/** The number of rows of a pivot that link the goal. */
async function linksOf(dataSource: DataSource, table: string): Promise<number> {
	const rows = await dataSource
		.createQueryBuilder()
		.select('COUNT(*)', 'count')
		.from(table, 'pivot')
		.where('pivot.timeGoalId = :goal', { goal: GOAL })
		.getRawOne<{ count: string | number }>();
	return Number(rows?.count ?? 0);
}

function exercise(harness: Harness) {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({
			...harness.options(),
			entities: coreEntities,
			logging: false
		} as DataSourceOptions);
		await dataSource.initialize();
		await harness.prepare(dataSource);
	}, TIMEOUT);

	afterAll(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
	});

	const migration = new CreateTimeGoalTables1791000009500();

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
		'creates the tables the entity declares, and running it again changes nothing',
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
		'keeps the projects and clients of a goal, and lets a link go with either side',
		async () => {
			await harness.seed(dataSource);

			await dataSource.getRepository(TimeGoal).save({
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				id: GOAL,
				name: 'Client A, at least 20 h a week',
				comparison: 'AT_LEAST',
				targetHours: 20.5,
				period: 'WEEK',
				scope: 'EMPLOYEE',
				projects: [{ id: PROJECT }],
				organizationContacts: [{ id: CLIENT }]
			} as unknown as TimeGoal);

			const [stored] = await dataSource
				.createQueryBuilder()
				.select('goal.targetHours', 'targetHours')
				.addSelect('goal.billableOnly', 'billableOnly')
				.from('time_goal', 'goal')
				.where('goal.id = :goal', { goal: GOAL })
				.getRawMany<{ targetHours: string | number; billableOnly: boolean | number }>();
			expect(Number(stored.targetHours)).toBe(20.5);
			expect(Boolean(Number(stored.billableOnly))).toBe(false);
			expect(await linksOf(dataSource, 'time_goal_project')).toBe(1);
			expect(await linksOf(dataSource, 'time_goal_organization_contact')).toBe(1);

			await dataSource.createQueryBuilder().delete().from(OrganizationProject).where({ id: PROJECT }).execute();
			expect(await linksOf(dataSource, 'time_goal_project')).toBe(0);
			expect(await linksOf(dataSource, 'time_goal_organization_contact')).toBe(1);

			await dataSource.createQueryBuilder().delete().from(TimeGoal).where({ id: GOAL }).execute();
			expect(await linksOf(dataSource, 'time_goal_organization_contact')).toBe(0);
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

			await up(true);
			expect(await existingTables(dataSource)).toEqual(TABLES);
			expect(await driftOf(dataSource)).toEqual([]);
		},
		TIMEOUT
	);
}

const postgresUrl = process.env.GAUZY_MIGRATION_TEST_POSTGRES_URL;
const mysqlUrl = process.env.GAUZY_MIGRATION_TEST_MYSQL_URL;
const isEmbedded = !isPostgres() && !isMySQL();

(isEmbedded ? describe : describe.skip)('CreateTimeGoalTables1791000009500 on SQLite', () => {
	exercise(wholeSchema(() => ({ type: 'better-sqlite3', database: ':memory:' })));
});

(isPostgres() && postgresUrl ? describe : describe.skip)('CreateTimeGoalTables1791000009500 on Postgres', () => {
	exercise(wholeSchema(() => ({ type: 'postgres', url: postgresUrl })));
});

(isMySQL() && mysqlUrl ? describe : describe.skip)('CreateTimeGoalTables1791000009500 on MySQL', () => {
	exercise(referencedTablesOnly(() => ({ type: 'mysql', url: mysqlUrl })));
});

describe('CreateTimeGoalTables1791000009500 statements', () => {
	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it('takes the advisory lock in the migration transaction on Postgres, and skips a foreign key that exists', async () => {
		const statements: Array<{ sql: string; params?: unknown[] }> = [];
		const queryRunner = {
			isTransactionActive: true,
			connection: { options: { type: 'postgres' } },
			query: jest.fn(async (sql: string, params?: unknown[]) => {
				statements.push({ sql, params });
				// Every foreign key exists but the goal's link to its project.
				if (sql.startsWith('SELECT 1 FROM pg_constraint'))
					return params?.[0] === 'FK_41fe9403ede67e86f68694b3a26' ? [] : [{}];
				return [];
			})
		};

		await new CreateTimeGoalTables1791000009500().up(queryRunner as never);

		expect(statements[0]).toEqual({ sql: 'SELECT pg_advisory_xact_lock($1)', params: [1791000009500] });
		const created = statements.filter(({ sql }) => sql.startsWith('CREATE TABLE')).map(({ sql }) => sql);
		expect(created).toHaveLength(3);
		expect(created[0]).toMatch(/^CREATE TABLE IF NOT EXISTS "time_goal" /);
		expect(created[1]).toContain(
			'CONSTRAINT "PK_891033af6e39fdf397f56b69c8a" PRIMARY KEY ("timeGoalId", "organizationProjectId")'
		);
		const added = statements.filter(({ sql }) => sql.startsWith('ALTER TABLE'));
		expect(added).toHaveLength(1);
		expect(added[0].sql).toContain(
			'FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE'
		);
	});

	it('creates the tables under a named lock on MySQL', async () => {
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

		await new CreateTimeGoalTables1791000009500().up(queryRunner as never);

		expect(statements[0]).toBe('SELECT GET_LOCK(?, 30) AS acquired');
		expect(statements[1]).toMatch(/^CREATE TABLE IF NOT EXISTS `time_goal` /);
		expect(statements.filter((sql) => sql.startsWith('ALTER TABLE'))).toHaveLength(11);
		expect(statements[statements.length - 1]).toBe('SELECT RELEASE_LOCK(?)');
	});

	it('drops the pivots before the goal table on down', async () => {
		const statements: string[] = [];
		const queryRunner = {
			connection: { options: { type: 'postgres' } },
			query: jest.fn(async (sql: string) => {
				statements.push(sql);
				return [];
			})
		};

		await new CreateTimeGoalTables1791000009500().down(queryRunner as never);

		expect(statements).toEqual([
			'DROP TABLE IF EXISTS "time_goal_organization_contact"',
			'DROP TABLE IF EXISTS "time_goal_project"',
			'DROP TABLE IF EXISTS "time_goal"'
		]);
	});
});
