import type * as BetterSqlite3 from 'better-sqlite3';
import { QueryRunner } from 'typeorm';
import { CreateWarehouseLayoutTables1791000000180 } from './1791000000180-CreateWarehouseLayoutTables';

// Required rather than imported (esModuleInterop is off), as core's measurement-audit.sqlite.spec does.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database: typeof import('better-sqlite3') = require('better-sqlite3');

/**
 * R5-04: a SQLite rename-aside rebuild (rename the table to a backup, create it again from its stored definition,
 * copy the rows, drop the backup) moves the table's indexes onto the backup, and dropping the backup drops them. The
 * rebuilds of CreateWarehouseLayoutTables1791000000180 never replayed them, so `warehouse_product_variant` lost every index — unique ones included — on every SQLite
 * database this migration ran on (the demo, desktop installs).
 *
 * Runs the migration's own rebuild against a real SQLite database (better-sqlite3) and compares the indexes.
 */
function sqliteRunner(db: BetterSqlite3.Database): QueryRunner {
	return {
		connection: { options: { type: 'better-sqlite3' } },
		query: async (sql: string, parameters: unknown[] = []) => {
			const statement = db.prepare(sql);
			if (statement.reader) return statement.all(...parameters);
			statement.run(...parameters);
			return [];
		},
		hasTable: async (table: string) =>
			Boolean(db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table)),
		hasColumn: async (table: string, column: string) =>
			(db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).some(
				(row) => row.name === column
			)
	} as unknown as QueryRunner;
}

const indexesOf = (db: BetterSqlite3.Database, table: string) =>
	db
		.prepare(
			`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL ORDER BY name`
		)
		.all(table);

const definitionOf = (db: BetterSqlite3.Database, table: string) =>
	(db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table) as { sql: string }).sql;

describe('CreateWarehouseLayoutTables1791000000180 keeps the indexes of the SQLite tables it rebuilds', () => {
	let db: BetterSqlite3.Database;

	beforeEach(() => {
		db = new Database(':memory:');
		// The tables the rebuilt foreign keys point at, as a migrated database has them.
		for (const parent of ['order', 'warehouse_bin', 'shipping_option']) {
			db.exec(`CREATE TABLE "${parent}" ("id" varchar PRIMARY KEY NOT NULL)`);
		}
	});

	afterEach(() => db.close());

	it.each([
		[
			'warehouse_product_variant',
			'"tenantId" varchar, "ref" varchar, "deletedAt" datetime, "binId" varchar',
			'rebuildSqliteTableWithBinForeignKey',
			'rebuildSqliteTableWithoutBinForeignKey',
			'FK_warehouse_product_variant_bin'
		]
	])('%s', async (table, columns, rebuildWith, rebuildWithout, constraint) => {
		db.exec(`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL, ${columns})`);
		db.exec(`CREATE INDEX "IDX_${table}_tenant" ON "${table}" ("tenantId")`);
		db.exec(`CREATE UNIQUE INDEX "UQ_${table}_ref" ON "${table}" ("tenantId", "ref") WHERE "deletedAt" IS NULL`);
		db.prepare(`INSERT INTO "${table}" ("id", "tenantId", "ref") VALUES (?, ?, ?)`).run(
			'row-1',
			'tenant-1',
			'ref-1'
		);
		const before = indexesOf(db, table);
		const migration = new CreateWarehouseLayoutTables1791000000180() as any;

		await migration[rebuildWith](sqliteRunner(db), table, 'test');

		expect(definitionOf(db, table)).toContain(constraint);
		expect(indexesOf(db, table)).toEqual(before);
		expect(db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get()).toEqual({ n: 1 });
		// The unique index is enforced again, not just listed.
		expect(() =>
			db
				.prepare(`INSERT INTO "${table}" ("id", "tenantId", "ref") VALUES (?, ?, ?)`)
				.run('row-2', 'tenant-1', 'ref-1')
		).toThrow(/UNIQUE constraint failed/);

		await migration[rebuildWithout](sqliteRunner(db), table);

		expect(indexesOf(db, table)).toEqual(before);
	});
});
