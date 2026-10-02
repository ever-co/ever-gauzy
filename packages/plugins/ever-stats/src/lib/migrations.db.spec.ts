import { DataSource, Logger, QueryRunner } from 'typeorm';
import { openTestDataSource, q, statsMigrations, TEST_TARGETS, TestDialect } from './fixtures/test-db';

/**
 * The two core migrations of the plugin on real databases: `up` creates the three tables, `up`
 * again is harmless, `down` removes them, `up` works again; the statements touch only the new tables
 * and their number does not depend on how many tenants exist.
 */
const TABLES = ['ever_instance', 'ever_stats_lease', 'ever_stats_report'];

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

async function tableNames(runner: QueryRunner, dialect: TestDialect): Promise<string[]> {
	const rows: Array<Record<string, string>> =
		dialect === 'postgres'
			? await runner.query(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()`)
			: dialect === 'mysql'
				? await runner.query(`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`)
				: await runner.query(`SELECT name FROM sqlite_master WHERE type = 'table'`);
	return rows.map((row) => row['name'] ?? row['NAME']).filter((name) => TABLES.includes(name)).sort();
}

describe.each(TEST_TARGETS)('EverInstance and EverStatsReport migrations on $name', (target) => {
	let dataSource: DataSource;
	let logger: RecordingLogger;
	const d = target.name;

	beforeAll(async () => {
		logger = new RecordingLogger();
		const plain = await openTestDataSource(target);
		const options = { ...plain.options, logging: true, logger };
		await plain.destroy();
		dataSource = new DataSource(options as never);
		await dataSource.initialize();
		for (const table of TABLES) {
			await dataSource.query(`DROP TABLE IF EXISTS ${q(d, table)}`);
		}
	});

	afterAll(async () => {
		for (const table of TABLES) {
			await dataSource.query(`DROP TABLE IF EXISTS ${q(d, table)}`);
		}
		await dataSource.destroy();
	});

	async function run(direction: 'up' | 'down'): Promise<string[]> {
		logger.queries.length = 0;
		const runner = dataSource.createQueryRunner();
		try {
			if (d === 'postgres') await runner.startTransaction();
			const migrations = statsMigrations();
			for (const migration of direction === 'up' ? migrations : [...migrations].reverse()) {
				await migration[direction](runner);
			}
			if (d === 'postgres') await runner.commitTransaction();
		} catch (error) {
			if (runner.isTransactionActive) await runner.rollbackTransaction();
			throw error;
		} finally {
			await runner.release();
		}
		return logger.queries.filter((query) => !/^(START TRANSACTION|BEGIN|COMMIT|SELECT pg_advisory_xact_lock)/i.test(query.trim()));
	}

	it('creates, survives a second up, drops, and creates again; touches nothing else', async () => {
		const first = await run('up');
		const runner = dataSource.createQueryRunner();
		expect(await tableNames(runner, d)).toEqual(TABLES);
		const second = await run('up');
		expect(await tableNames(runner, d)).toEqual(TABLES);
		expect(second.length).toBe(first.length);
		await run('down');
		expect(await tableNames(runner, d)).toEqual([]);
		await run('up');
		expect(await tableNames(runner, d)).toEqual(TABLES);
		await runner.release();
		for (const statement of first) {
			expect(statement).toMatch(/^(CREATE (TABLE|INDEX) IF NOT EXISTS|DROP TABLE IF EXISTS)/);
			expect(statement).not.toMatch(/\b(tenant|organization|user)\b/i);
			expect(statement).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER)\b/i);
		}
		expect(first.length).toBeLessThanOrEqual(6);
	});
});
