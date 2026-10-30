import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { createCoreTables, dropTables, migrateUp, openTestDataSource, PLUGIN_TABLES, TEST_TARGETS } from '../fixtures/test-db';

const MIGRATIONS = join(__dirname, '../../../../../core/src/lib/database/migrations');

/**
 * The core `EverConnectIdentity` migration on every database the suites reach (SQLite always;
 * Postgres and MySQL with `EVER_CONNECT_TEST_POSTGRES_URL` / `EVER_CONNECT_TEST_MYSQL_URL`): `up`
 * creates the two tables and the connection column, running it again changes nothing, and `down`
 * removes exactly what it added.
 */
describe.each(TEST_TARGETS)('EverConnectIdentity migration on $name', (target) => {
	let dataSource: DataSource;
	const { EverConnectIdentity1791000003500 } = require(join(MIGRATIONS, '1791000003500-EverConnectIdentity'));

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

	it('up creates the tables and the column; running it again is harmless; down removes them', async () => {
		expect(await has('ever_connect_person_link_report')).toBe(true);
		expect(await has('ever_connect_person_request')).toBe(true);
		expect(await has('ever_connect_connection', 'publicUrlCheckUntil')).toBe(true);
		const runner = dataSource.createQueryRunner();
		try {
			const migration = new EverConnectIdentity1791000003500();
			await migration.up(runner);
			expect(await has('ever_connect_person_request', 'exportUrlEncrypted')).toBe(true);
			await migration.down(runner);
			expect(await has('ever_connect_person_link_report')).toBe(false);
			expect(await has('ever_connect_person_request')).toBe(false);
			expect(await has('ever_connect_connection', 'publicUrlCheckUntil')).toBe(false);
			// The connection table itself stays.
			expect(await has('ever_connect_connection', 'status')).toBe(true);
			await migration.up(runner);
			expect(await has('ever_connect_connection', 'publicUrlCheckUntil')).toBe(true);
		} finally {
			await runner.release();
		}
	});
});
