import { DataSource, Logger, QueryRunner } from 'typeorm';
import { AuthZitadel1790000018000 } from './migrations/1790000018000-AuthZitadel';

/**
 * Runs the AuthZitadel migration against real databases: SQLite always, Postgres and MySQL when
 * `MIGRATION_TEST_POSTGRES_URL` / `MIGRATION_TEST_MYSQL_URL` point at an empty, disposable database.
 *
 * Proves: `up` creates the four tables, `up` again is harmless, `down` removes them, `up` works again;
 * the statements touch only the new tables (no data statement at all), and their number does not
 * depend on how many tenants exist.
 */
const TABLES = ['zitadel_account', 'zitadel_organization', 'zitadel_session', 'zitadel_logout_jti'];

class RecordingLogger implements Logger {
	readonly queries: string[] = [];
	logQuery(query: string) {
		this.queries.push(query);
	}
	logQueryError() {}
	logQuerySlow() {}
	logSchemaBuild() {}
	logMigration() {}
	log() {}
}

type Dialect = 'better-sqlite3' | 'postgres' | 'mysql';

const targets: Array<{ name: Dialect; url?: string }> = [
	{ name: 'better-sqlite3' },
	...(process.env['MIGRATION_TEST_POSTGRES_URL'] ? [{ name: 'postgres' as const, url: process.env['MIGRATION_TEST_POSTGRES_URL'] }] : []),
	...(process.env['MIGRATION_TEST_MYSQL_URL'] ? [{ name: 'mysql' as const, url: process.env['MIGRATION_TEST_MYSQL_URL'] }] : [])
];

function quote(dialect: Dialect, name: string): string {
	return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

async function tableNames(runner: QueryRunner, dialect: Dialect): Promise<string[]> {
	const rows: Array<Record<string, string>> =
		dialect === 'postgres'
			? await runner.query(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()`)
			: dialect === 'mysql'
				? await runner.query(`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`)
				: await runner.query(`SELECT name FROM sqlite_master WHERE type = 'table'`);
	return rows.map((row) => row['name'] ?? row['NAME']).filter((name) => TABLES.includes(name)).sort();
}

describe.each(targets)('AuthZitadel migration on $name', ({ name: dialect, url }) => {
	let dataSource: DataSource;
	let logger: RecordingLogger;

	beforeAll(async () => {
		logger = new RecordingLogger();
		dataSource = new DataSource(
			dialect === 'better-sqlite3'
				? { type: 'better-sqlite3', database: ':memory:', logging: true, logger }
				: ({ type: dialect, url, logging: true, logger } as never)
		);
		await dataSource.initialize();
		const runner = dataSource.createQueryRunner();
		const idType = dialect === 'postgres' ? 'uuid' : dialect === 'mysql' ? 'varchar(255)' : 'varchar';
		for (const table of ['tenant', 'organization', 'user']) {
			await runner.query(`CREATE TABLE IF NOT EXISTS ${quote(dialect, table)} (${quote(dialect, 'id')} ${idType} PRIMARY KEY)`);
		}
		await runner.release();
	});

	afterAll(async () => {
		if (!dataSource?.isInitialized) {
			return;
		}
		const runner = dataSource.createQueryRunner();
		for (const table of [...TABLES, 'user', 'organization', 'tenant']) {
			await runner.query(`DROP TABLE IF EXISTS ${quote(dialect, table)}`);
		}
		await runner.release();
		await dataSource.destroy();
	});

	async function run(direction: 'up' | 'down'): Promise<string[]> {
		const runner = dataSource.createQueryRunner();
		const start = logger.queries.length;
		await runner.startTransaction();
		try {
			await new AuthZitadel1790000018000()[direction](runner);
			await runner.commitTransaction();
		} catch (error) {
			await runner.rollbackTransaction();
			throw error;
		} finally {
			await runner.release();
		}
		return logger.queries.slice(start).filter((query) => !/^(START TRANSACTION|BEGIN|COMMIT|ROLLBACK)/i.test(query));
	}

	it('creates the four tables, idempotently, and drops them on down', async () => {
		const first = await run('up');
		let runner = dataSource.createQueryRunner();
		expect(await tableNames(runner, dialect)).toEqual([...TABLES].sort());
		await runner.release();

		// A second up changes nothing and does not fail.
		const second = await run('up');
		expect(second.length).toBe(first.length);

		await run('down');
		runner = dataSource.createQueryRunner();
		expect(await tableNames(runner, dialect)).toEqual([]);
		await runner.release();

		await run('up');
		runner = dataSource.createQueryRunner();
		expect(await tableNames(runner, dialect)).toEqual([...TABLES].sort());
		await runner.release();
	});

	it('only creates new tables and indexes: no data statement, no change to an existing table', async () => {
		await run('down');
		const statements = await run('up');
		for (const statement of statements) {
			expect(statement).toMatch(/^(SET LOCAL lock_timeout|SELECT pg_advisory_xact_lock|CREATE (UNIQUE )?INDEX IF NOT EXISTS|CREATE TABLE IF NOT EXISTS)/);
			// `ON DELETE CASCADE` / `ON UPDATE NO ACTION` are foreign key actions and MySQL's
			// `ON UPDATE CURRENT_TIMESTAMP(6)` is a column default, not statements.
			const withoutColumnClauses = statement
				.replace(/\bON (DELETE|UPDATE) (CASCADE|NO ACTION|SET NULL|SET DEFAULT|RESTRICT)\b/gi, '')
				.replace(/\bON UPDATE CURRENT_TIMESTAMP(\(\d+\))?/gi, '');
			expect(withoutColumnClauses).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|DROP)\b/i);
			if (/^CREATE (UNIQUE )?INDEX/.test(statement)) {
				expect(statement).toMatch(/ ON ["`]zitadel_/);
			}
			if (/^CREATE TABLE/.test(statement)) {
				expect(statement).toMatch(/^CREATE TABLE IF NOT EXISTS ["`]zitadel_/);
			}
		}
	});

	it('runs the same statements however many tenants exist (no per-tenant work)', async () => {
		await run('down');
		const empty = await run('up');
		await run('down');
		const runner = dataSource.createQueryRunner();
		for (let i = 0; i < 50; i++) {
			const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
			await runner.query(`INSERT INTO ${quote(dialect, 'tenant')} (${quote(dialect, 'id')}) VALUES ('${id}')`);
		}
		await runner.release();
		const populated = await run('up');
		expect(populated).toEqual(empty);
	});

	it("removes a person's links and sessions when the Gauzy user is deleted", async () => {
		const q = (name: string) => quote(dialect, name);
		const userId = '00000000-0000-4000-9000-000000000001';
		const otherUserId = '00000000-0000-4000-9000-000000000002';
		const runner = dataSource.createQueryRunner();
		try {
			for (const id of [userId, otherUserId]) {
				await runner.query(`INSERT INTO ${q('user')} (${q('id')}) VALUES ('${id}')`);
				await runner.query(
					`INSERT INTO ${q('zitadel_account')} (${q('id')}, ${q('issuer')}, ${q('subject')}, ${q('userId')}, ${q('linkMethod')}, ${q('linkedAt')}) ` +
						`VALUES ('${id.replace('9000', 'a000')}', 'https://issuer.example.test', 'subject-${id.slice(-1)}', '${id}', 'explicit', '2026-01-01 00:00:00')`
				);
				await runner.query(
					`INSERT INTO ${q('zitadel_session')} (${q('id')}, ${q('sid')}, ${q('userId')}) VALUES ('${id.replace('9000', 'b000')}', 'sid-1', '${id}')`
				);
			}

			await runner.query(`DELETE FROM ${q('user')} WHERE ${q('id')} = '${userId}'`);

			const remaining = async (table: string) =>
				(await runner.query(`SELECT ${q('userId')} AS ${q('userId')} FROM ${q(table)}`)).map(
					(row: Record<string, string>) => row['userId']
				);
			expect(await remaining('zitadel_account')).toEqual([otherUserId]);
			expect(await remaining('zitadel_session')).toEqual([otherUserId]);
		} finally {
			for (const table of ['zitadel_session', 'zitadel_account', 'user']) {
				await runner.query(`DELETE FROM ${q(table)}`);
			}
			await runner.release();
		}
	});
});
