import { QueryRunner } from 'typeorm';
import { AddWarehouseSellerColumn1791000000436 } from './migrations/1791000000436-AddWarehouseSellerColumn';

/**
 * On PostgreSQL a statement that fails aborts the migration's transaction: every later statement, TypeORM's own
 * `INSERT INTO "migrations"` included, answers `25P02 current transaction is aborted`. Catching the error in the
 * migration does not undo that. core's 1791000000095 already creates `IDX_warehouse_seller` on a database upgraded
 * from develop (the `warehouse` table exists there), and 0436's bare `CREATE INDEX` then failed inside its
 * transaction — swallowed, but the migration could never record itself, so every boot failed the same way.
 *
 * The runner below answers the way PostgreSQL does for a database where the column and the index already exist.
 */
function upgradedPostgresRunner(): { runner: QueryRunner; recordMigration: () => Promise<unknown> } {
	let aborted = false;
	const query = async (sql: string) => {
		if (aborted) throw new Error('current transaction is aborted, commands ignored until end of transaction block');
		if (/^\s*CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)"IDX_warehouse_seller"/i.test(sql)) {
			aborted = true;
			throw new Error('relation "IDX_warehouse_seller" already exists');
		}
		return [];
	};
	const runner = {
		connection: { options: { type: 'postgres' } },
		hasTable: async () => true,
		hasColumn: async () => true,
		query
	} as unknown as QueryRunner;

	return { runner, recordMigration: () => query(`INSERT INTO "migrations"("timestamp", "name") VALUES ($1, $2)`) };
}

describe('AddWarehouseSellerColumn1791000000436 on a PostgreSQL database upgraded from develop', () => {
	it('leaves the transaction usable when IDX_warehouse_seller already exists, so the migration records itself', async () => {
		const { runner, recordMigration } = upgradedPostgresRunner();

		await new AddWarehouseSellerColumn1791000000436().up(runner);

		await expect(recordMigration()).resolves.toEqual([]);
	});
});
