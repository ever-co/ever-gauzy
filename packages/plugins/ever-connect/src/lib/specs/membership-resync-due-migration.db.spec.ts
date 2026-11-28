import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { createCoreTables, dropTables, migrateUp, openTestDataSource, PLUGIN_TABLES, TEST_TARGETS } from '../fixtures/test-db';

const MIGRATIONS = join(__dirname, '../../../../../core/src/lib/database/migrations');

/**
 * The core `EverConnectMembershipResyncDue` migration on every database the suites reach (SQLite always; Postgres and
 * MySQL with `EVER_CONNECT_TEST_POSTGRES_URL` / `EVER_CONNECT_TEST_MYSQL_URL`): `up` adds the connection column,
 * running it again changes nothing, `down` removes exactly that column, and `up` adds it again.
 */
describe.each(TEST_TARGETS)('EverConnectMembershipResyncDue migration on $name', (target) => {
	let dataSource: DataSource;
	const { EverConnectMembershipResyncDue1791000019900 } = require(
		join(MIGRATIONS, '1791000019900-EverConnectMembershipResyncDue')
	);

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

	async function has(column: string): Promise<boolean> {
		const runner = dataSource.createQueryRunner();
		try {
			return await runner.hasColumn('ever_connect_connection', column);
		} finally {
			await runner.release();
		}
	}

	it('up adds the column; running it again is harmless; down removes it; up adds it again', async () => {
		expect(await has('membershipResyncDueAt')).toBe(true);
		const runner = dataSource.createQueryRunner();
		try {
			const migration = new EverConnectMembershipResyncDue1791000019900();
			await migration.up(runner);
			expect(await has('membershipResyncDueAt')).toBe(true);
			await migration.down(runner);
			expect(await has('membershipResyncDueAt')).toBe(false);
			// The table and its other columns stay.
			expect(await has('feedCursor')).toBe(true);
			expect(await has('publicUrlCheckUntil')).toBe(true);
			await migration.down(runner);
			await migration.up(runner);
			expect(await has('membershipResyncDueAt')).toBe(true);
		} finally {
			await runner.release();
		}
	});
});
