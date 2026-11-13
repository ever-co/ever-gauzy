import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, QueryRunner } from 'typeorm';
import {
	AddEmployeePlaceholder1791000009700,
	INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY,
	INVITE_PLACEHOLDER_EMPLOYEE_INDEX
} from './migrations/1791000009700-AddEmployeePlaceholder';

/**
 * Members without an account, run for real on SQLite against a minimal fixture of the two tables: every existing
 * employee is a member with an account and has no placeholder email, every existing invitation hands nothing over, and
 * a placeholder going away clears the invitation's link to it.
 */
const EMPLOYEE = 'a0000000-0000-4000-8000-000000000001';
const INVITE = 'b0000000-0000-4000-8000-000000000001';

type ColumnInfo = { name: string; notnull: number; dflt_value: string | null };

describe('employee placeholder migration on SQLite', () => {
	let dataSource: DataSource;
	let dbPath: string;

	beforeEach(async () => {
		dbPath = path.join(
			os.tmpdir(),
			`gauzy-employee-placeholder-${process.pid}-${Date.now()}-${Math.random()}.sqlite3`
		);
		dataSource = new DataSource({ type: 'better-sqlite3', database: dbPath, synchronize: false, logging: false });
		await dataSource.initialize();
		await dataSource.query('CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar)');
		await dataSource.query('CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar NOT NULL)');
		await dataSource.query(`INSERT INTO "employee" ("id") VALUES (?)`, [EMPLOYEE]);
		await dataSource.query(`INSERT INTO "invite" ("id", "email") VALUES (?, 'amina@example.com')`, [INVITE]);
	});

	afterEach(async () => {
		if (dataSource?.isInitialized) {
			await dataSource.destroy();
		}
		fs.rmSync(dbPath, { force: true });
	});

	const run = async (direction: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await new AddEmployeePlaceholder1791000009700()[direction](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	const columnOf = async (table: string, name: string): Promise<ColumnInfo | undefined> => {
		const columns = (await dataSource.query(`PRAGMA table_info(${table})`)) as ColumnInfo[];
		return columns.find((column) => column.name === name);
	};

	const inviteIndexNames = async (): Promise<string[]> => {
		const indexes = (await dataSource.query('PRAGMA index_list(invite)')) as Array<{ name: string }>;
		return indexes.map((index) => index.name);
	};

	it('marks every existing employee as a member with an account, without a placeholder email', async () => {
		await run('up');

		expect(await columnOf('employee', 'isPlaceholder')).toMatchObject({ notnull: 1, dflt_value: '0' });
		expect(await columnOf('employee', 'placeholderEmail')).toMatchObject({ notnull: 0, dflt_value: null });
		const [employee] = await dataSource.query(
			`SELECT "isPlaceholder", "placeholderEmail" FROM "employee" WHERE "id" = ?`,
			[EMPLOYEE]
		);
		expect(employee).toEqual({ isPlaceholder: 0, placeholderEmail: null });
	});

	it('adds a nullable, indexed link from an invitation to the placeholder it hands over, empty for every existing one', async () => {
		await run('up');

		expect(await columnOf('invite', 'placeholderEmployeeId')).toMatchObject({ notnull: 0, dflt_value: null });
		expect(await inviteIndexNames()).toContain(INVITE_PLACEHOLDER_EMPLOYEE_INDEX);
		const foreignKeys = await dataSource.query('PRAGMA foreign_key_list(invite)');
		expect(foreignKeys).toEqual([
			expect.objectContaining({
				table: 'employee',
				from: 'placeholderEmployeeId',
				to: 'id',
				on_delete: 'SET NULL'
			})
		]);
		const [invite] = await dataSource.query(`SELECT "placeholderEmployeeId" FROM "invite" WHERE "id" = ?`, [
			INVITE
		]);
		expect(invite.placeholderEmployeeId).toBeNull();
	});

	it('clears the link when the placeholder an invitation hands over is removed', async () => {
		await run('up');
		await dataSource.query(`UPDATE "invite" SET "placeholderEmployeeId" = ? WHERE "id" = ?`, [EMPLOYEE, INVITE]);

		await dataSource.query(`DELETE FROM "employee" WHERE "id" = ?`, [EMPLOYEE]);

		const [invite] = await dataSource.query(`SELECT "placeholderEmployeeId" FROM "invite" WHERE "id" = ?`, [
			INVITE
		]);
		expect(invite.placeholderEmployeeId).toBeNull();
	});

	it('is a no-op when run twice, drops the index on down and keeps the columns, and runs up again', async () => {
		await run('up');
		await expect(run('up')).resolves.toBeUndefined();

		await run('down');
		expect(await inviteIndexNames()).not.toContain(INVITE_PLACEHOLDER_EMPLOYEE_INDEX);
		expect(await columnOf('employee', 'isPlaceholder')).toBeDefined();
		expect(await columnOf('invite', 'placeholderEmployeeId')).toBeDefined();

		await run('up');
		expect(await inviteIndexNames()).toContain(INVITE_PLACEHOLDER_EMPLOYEE_INDEX);
	});
});

/** A query runner that records the statements it is given, answering the checks as the arguments say. */
function scriptedRunner(type: 'postgres' | 'mysql', state: { hasColumns: boolean; hasKeyAndIndex: boolean }) {
	const queries: string[] = [];
	const queryRunner = {
		connection: { options: { type } },
		isTransactionActive: true,
		hasTable: async () => true,
		hasColumn: async () => state.hasColumns,
		getTable: async () => ({
			foreignKeys: state.hasKeyAndIndex ? [{ name: INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY }] : [],
			indices: state.hasKeyAndIndex ? [{ name: INVITE_PLACEHOLDER_EMPLOYEE_INDEX }] : []
		}),
		query: async (sql: string) => {
			queries.push(sql);
			const isLock = sql.includes('GET_LOCK');
			if (isLock) {
				return [{ acquired: 1 }];
			}
			return [];
		}
	} as unknown as QueryRunner;
	return { queries, queryRunner };
}

describe('employee placeholder migration on Postgres', () => {
	it('serialises concurrent runs and adds the three columns, the index and the foreign key when they are missing', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumns: false, hasKeyAndIndex: false });

		await new AddEmployeePlaceholder1791000009700().up(queryRunner);

		expect(queries).toEqual([
			'SELECT pg_advisory_xact_lock($1)',
			'ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "isPlaceholder" boolean NOT NULL DEFAULT false',
			'ALTER TABLE "employee" ADD COLUMN IF NOT EXISTS "placeholderEmail" character varying',
			'ALTER TABLE "invite" ADD COLUMN IF NOT EXISTS "placeholderEmployeeId" uuid',
			`CREATE INDEX IF NOT EXISTS "${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}" ON "invite" ("placeholderEmployeeId")`,
			`ALTER TABLE "invite" ADD CONSTRAINT "${INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY}" FOREIGN KEY ("placeholderEmployeeId") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		]);
	});

	it('takes no ACCESS EXCLUSIVE lock for columns created ahead of the deploy (no ALTER TABLE at all)', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumns: true, hasKeyAndIndex: true });

		await new AddEmployeePlaceholder1791000009700().up(queryRunner);

		expect(queries.some((sql) => sql.startsWith('ALTER TABLE'))).toBe(false);
	});

	it('drops the foreign key, the index and the columns on down', async () => {
		const { queries, queryRunner } = scriptedRunner('postgres', { hasColumns: true, hasKeyAndIndex: true });

		await new AddEmployeePlaceholder1791000009700().down(queryRunner);

		expect(queries).toEqual([
			`ALTER TABLE "invite" DROP CONSTRAINT IF EXISTS "${INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY}"`,
			`DROP INDEX IF EXISTS "${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}"`,
			'ALTER TABLE "invite" DROP COLUMN IF EXISTS "placeholderEmployeeId"',
			'ALTER TABLE "employee" DROP COLUMN IF EXISTS "placeholderEmail"',
			'ALTER TABLE "employee" DROP COLUMN IF EXISTS "isPlaceholder"'
		]);
	});
});

describe('employee placeholder migration on MySQL', () => {
	it('takes a named lock MySQL accepts and adds the columns, then the index, then the foreign key', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumns: false, hasKeyAndIndex: false });
		const migration = new AddEmployeePlaceholder1791000009700();

		await migration.up(queryRunner);

		expect(migration.mysqlLockName.length).toBeLessThanOrEqual(64);
		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			'ALTER TABLE `employee` ADD COLUMN `isPlaceholder` tinyint NOT NULL DEFAULT 0',
			'ALTER TABLE `employee` ADD COLUMN `placeholderEmail` varchar(255) NULL',
			'ALTER TABLE `invite` ADD COLUMN `placeholderEmployeeId` varchar(255) NULL',
			`CREATE INDEX \`${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}\` ON \`invite\` (\`placeholderEmployeeId\`)`,
			`ALTER TABLE \`invite\` ADD CONSTRAINT \`${INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY}\` FOREIGN KEY (\`placeholderEmployeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
			'SELECT RELEASE_LOCK(?)'
		]);
	});

	it('writes nothing when everything is already there', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumns: true, hasKeyAndIndex: true });

		await new AddEmployeePlaceholder1791000009700().up(queryRunner);

		expect(queries).toEqual(['SELECT GET_LOCK(?, 120) AS `acquired`', 'SELECT RELEASE_LOCK(?)']);
	});

	it('drops the foreign key before the index it needs, then the columns, on down', async () => {
		const { queries, queryRunner } = scriptedRunner('mysql', { hasColumns: true, hasKeyAndIndex: true });

		await new AddEmployeePlaceholder1791000009700().down(queryRunner);

		expect(queries).toEqual([
			'SELECT GET_LOCK(?, 120) AS `acquired`',
			`ALTER TABLE \`invite\` DROP FOREIGN KEY \`${INVITE_PLACEHOLDER_EMPLOYEE_FOREIGN_KEY}\``,
			`DROP INDEX \`${INVITE_PLACEHOLDER_EMPLOYEE_INDEX}\` ON \`invite\``,
			'ALTER TABLE `invite` DROP COLUMN `placeholderEmployeeId`',
			'ALTER TABLE `employee` DROP COLUMN `placeholderEmail`',
			'ALTER TABLE `employee` DROP COLUMN `isPlaceholder`',
			'SELECT RELEASE_LOCK(?)'
		]);
	});
});
