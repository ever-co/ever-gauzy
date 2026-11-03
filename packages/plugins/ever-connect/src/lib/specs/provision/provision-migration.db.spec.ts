import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { createCoreTables, dropTables, insert, migrateUp, openTestDataSource, PLUGIN_TABLES, TEST_TARGETS } from '../../fixtures/test-db';

const MIGRATIONS = join(__dirname, '../../../../../../core/src/lib/database/migrations');

/**
 * The core `EverConnectProvision` migration on every database the suites reach (SQLite always;
 * Postgres and MySQL with `EVER_CONNECT_TEST_POSTGRES_URL` / `EVER_CONNECT_TEST_MYSQL_URL`): `up`
 * creates the two tables with their unique keys, running it again changes nothing, and `down` removes
 * exactly them.
 */
describe.each(TEST_TARGETS)('EverConnectProvision migration on $name', (target) => {
	let dataSource: DataSource;
	const { EverConnectProvision1791000003900 } = require(join(MIGRATIONS, '1791000003900-EverConnectProvision'));

	beforeEach(async () => {
		dataSource = await openTestDataSource(target);
		await dropTables(dataSource, target.name, PLUGIN_TABLES);
		await createCoreTables(dataSource, target.name);
		await migrateUp(dataSource);
	});

	afterEach(async () => {
		await dropTables(dataSource, target.name, PLUGIN_TABLES);
		await dataSource.destroy();
	});

	async function has(table: string, column?: string): Promise<boolean> {
		const runner = dataSource.createQueryRunner();
		try {
			return column ? await runner.hasColumn(table, column) : await runner.hasTable(table);
		} finally {
			await runner.release();
		}
	}

	it('up creates the tables; running it again is harmless; down removes them and nothing else', async () => {
		expect(await has('ever_connect_provision_intent', 'keyHash')).toBe(true);
		expect(await has('ever_connect_provision_result', 'completionNextAt')).toBe(true);
		const runner = dataSource.createQueryRunner();
		try {
			const migration = new EverConnectProvision1791000003900();
			await migration.up(runner);
			await migration.down(runner);
			expect(await has('ever_connect_provision_intent')).toBe(false);
			expect(await has('ever_connect_provision_result')).toBe(false);
			expect(await has('ever_connect_connection', 'status')).toBe(true);
			expect(await has('ever_connect_person_request')).toBe(true);
			await migration.up(runner);
			expect(await has('ever_connect_provision_result')).toBe(true);
		} finally {
			await runner.release();
		}
	});

	it('one row per key digest, and one result per jti', async () => {
		const intent = { intent: '{}', idempotencyKey: 'k1', status: 'pending', receivedAt: 1, expiresAt: 2, updatedAt: 1 };
		await insert(dataSource, target.name, 'ever_connect_provision_intent', { jti: 'J1', keyHash: 'h1', ...intent });
		await expect(
			insert(dataSource, target.name, 'ever_connect_provision_intent', { jti: 'J2', keyHash: 'h1', ...intent })
		).rejects.toThrow();
		const result = { status: 'pending', createdAt: 1, updatedAt: 1 };
		await insert(dataSource, target.name, 'ever_connect_provision_result', { idempotencyKey: 'k1', jti: 'J1', ...result });
		await expect(
			insert(dataSource, target.name, 'ever_connect_provision_result', { idempotencyKey: 'k2', jti: 'J1', ...result })
		).rejects.toThrow();
		const [row] = await dataSource.query(`SELECT * FROM ${target.name === 'mysql' ? '`ever_connect_provision_result`' : '"ever_connect_provision_result"'}`);
		expect(Number(row['completionAttempts'])).toBe(0);
	});
});
