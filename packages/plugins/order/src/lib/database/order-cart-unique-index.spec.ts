// `@gauzy/core` is doubled for the reason the package's other migration suites state: the migration set
// imports a helper from its barrel, which boots the whole application graph. The tick under test calls
// nothing in it.
jest.mock('@gauzy/core', () => ({}));

import type * as BetterSqlite3 from 'better-sqlite3';
import { QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import { ALL_ORDER_MIGRATIONS } from './order-migrations';
import { AddOrderCartUniqueIndex1791000000782 } from './migrations/1791000000782-AddOrderCartUniqueIndex';

// Required rather than imported (esModuleInterop is off), as the package's SQLite rebuild spec does.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database: typeof import('better-sqlite3') = require('better-sqlite3');

/**
 * R3-10: one cart becomes at most one order.
 *
 * `IDX_order_cart` was not unique, so the database accepted a second live order of one cart — which is what
 * two concurrent completions produced. The tick adds `UQ_order_cart` beside it. Two halves are pinned:
 *
 * - **a real SQLite database** (better-sqlite3) refuses a second live order of a cart once the tick ran,
 *   still accepts any number of orders that name no cart, and a soft-deleted order no longer holds its
 *   cart; and the tick, run where duplicates already exist, **changes no row and creates nothing**;
 * - **a recording runner** for the statements each dialect is given, the guards and `down`.
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
			(db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).some((row) => row.name === column)
	} as unknown as QueryRunner;
}

/** The slice of `order` the index is about, as the create tick declares it on SQLite. */
function orderTable(): BetterSqlite3.Database {
	const db = new Database(':memory:');

	db.exec(`CREATE TABLE "order" ("id" varchar PRIMARY KEY NOT NULL, "cartId" varchar, "deletedAt" datetime)`);
	db.exec(`CREATE INDEX "IDX_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL`);

	return db;
}

const insert = (db: BetterSqlite3.Database, id: string, cartId: string | null, deletedAt: string | null = null) =>
	db.prepare(`INSERT INTO "order" ("id", "cartId", "deletedAt") VALUES (?, ?, ?)`).run(id, cartId, deletedAt);

describe('AddOrderCartUniqueIndex1791000000782 — on a real SQLite database', () => {
	let warn: jest.SpyInstance;

	beforeEach(() => {
		warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a second live order of one cart, and keeps every other order legal', async () => {
		const db = orderTable();

		await new AddOrderCartUniqueIndex1791000000782().up(sqliteRunner(db));

		insert(db, 'order-1', 'cart-1');
		expect(() => insert(db, 'order-2', 'cart-1')).toThrow(/UNIQUE/);

		// Orders that name no cart are not duplicates of one another.
		insert(db, 'order-3', null);
		insert(db, 'order-4', null);

		// A soft-deleted order no longer holds its cart.
		insert(db, 'order-5', 'cart-2', '2026-10-17 00:00:00');
		insert(db, 'order-6', 'cart-2');

		// `IDX_order_cart` is left exactly where it was: this tick adds, it does not replace.
		const names = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'order'`).all() as Array<{
			name: string;
		}>).map((row) => row.name);
		expect(names).toEqual(expect.arrayContaining(['IDX_order_cart', 'UQ_order_cart']));
	});

	it('changes no row and creates nothing where two live orders already share a cart, and says which', async () => {
		const db = orderTable();

		insert(db, 'order-1', 'cart-1');
		insert(db, 'order-2', 'cart-1');
		insert(db, 'order-3', 'cart-2');

		await new AddOrderCartUniqueIndex1791000000782().up(sqliteRunner(db));

		expect(db.prepare(`SELECT COUNT(*) AS "n" FROM "order"`).get()).toEqual({ n: 3 });
		expect(db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'UQ_order_cart'`).get()).toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('cart-1'));
		expect(warn.mock.calls[0][0]).not.toContain('cart-2');
	});

	it('is reversed by down, and down is a no-op once the index is gone', async () => {
		const db = orderTable();
		const migration = new AddOrderCartUniqueIndex1791000000782();

		await migration.up(sqliteRunner(db));
		await migration.down(sqliteRunner(db));
		await migration.down(sqliteRunner(db));

		insert(db, 'order-1', 'cart-1');
		expect(() => insert(db, 'order-2', 'cart-1')).not.toThrow();
		expect(db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = 'IDX_order_cart'`).get()).toBeTruthy();
	});
});

/**
 * A query runner that records what the tick asked for.
 *
 * @param state The dialect, whether the index is already there, the carts the duplicate probe answers,
 * and whether the MySQL table carries the generated `deletedKey` column.
 */
function recordingRunner(state: { type: DatabaseTypeEnum; index?: boolean; duplicates?: string[]; deletedKey?: boolean }) {
	const statements: string[] = [];

	return {
		statements,
		connection: { options: { type: state.type } },
		hasTable: async (table: string) => table === 'order',
		hasColumn: async (table: string, column: string) => table === 'order' && column === 'deletedKey' && state.deletedKey !== false,
		query: async (sql: string) => {
			statements.push(sql);

			if (/FROM (pg_indexes|sqlite_master|information_schema\.statistics)/.test(sql)) {
				return state.index ? [{ present: 1 }] : [];
			}

			if (/GROUP BY/.test(sql)) {
				return (state.duplicates ?? []).map((cartId) => ({ cartId }));
			}

			return [];
		}
	};
}

/** The statements that change the schema, with the probes left out. */
const ddlOf = (runner: { statements: string[] }): string[] => runner.statements.filter((statement) => !statement.startsWith('SELECT '));

describe('AddOrderCartUniqueIndex1791000000782 — what it issues', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('states the index in each dialect’s own form', async () => {
		const expected: Record<string, string> = {
			[DatabaseTypeEnum.postgres]:
				'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL',
			[DatabaseTypeEnum.sqlite]:
				'CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL',
			[DatabaseTypeEnum.mysql]: 'CREATE UNIQUE INDEX `UQ_order_cart` ON `order` (`cartId`, `deletedKey`)'
		};

		for (const [type, statement] of Object.entries(expected)) {
			const runner = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddOrderCartUniqueIndex1791000000782().up(runner as never);

			expect(ddlOf(runner)).toEqual([statement]);
		}
	});

	it('falls back to cartId alone on a MySQL table without the generated deletedKey, with a probe that agrees', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.mysql, deletedKey: false });

		await new AddOrderCartUniqueIndex1791000000782().up(runner as never);

		expect(ddlOf(runner)).toEqual(['CREATE UNIQUE INDEX `UQ_order_cart` ON `order` (`cartId`)']);
		expect(runner.statements.find((statement) => /GROUP BY/.test(statement))).not.toMatch(/deletedAt/);
	});

	it('issues no DDL where the index is already there, or where duplicates exist — and never a DELETE or UPDATE', async () => {
		for (const type of [DatabaseTypeEnum.postgres, DatabaseTypeEnum.sqlite, DatabaseTypeEnum.mysql]) {
			const present = recordingRunner({ type, index: true });

			await new AddOrderCartUniqueIndex1791000000782().up(present as never);
			expect(ddlOf(present)).toEqual([]);

			const duplicated = recordingRunner({ type, duplicates: ['cart-1'] });

			await new AddOrderCartUniqueIndex1791000000782().up(duplicated as never);
			expect(ddlOf(duplicated)).toEqual([]);
			expect(duplicated.statements.join('\n')).not.toMatch(/DELETE|UPDATE/);
		}
	});

	it('drops exactly the index it creates, only where it is present', async () => {
		const expected: Record<string, string> = {
			[DatabaseTypeEnum.postgres]: 'DROP INDEX IF EXISTS "UQ_order_cart"',
			[DatabaseTypeEnum.sqlite]: 'DROP INDEX IF EXISTS "UQ_order_cart"',
			[DatabaseTypeEnum.mysql]: 'DROP INDEX `UQ_order_cart` ON `order`'
		};

		for (const [type, statement] of Object.entries(expected)) {
			const present = recordingRunner({ type: type as DatabaseTypeEnum, index: true });

			await new AddOrderCartUniqueIndex1791000000782().down(present as never);
			expect(ddlOf(present)).toEqual([statement]);

			const absent = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddOrderCartUniqueIndex1791000000782().down(absent as never);
			expect(ddlOf(absent)).toEqual([]);
		}
	});

	it('refuses a dialect it has no statements for', async () => {
		const runner = recordingRunner({ type: 'oracle' as DatabaseTypeEnum });

		await expect(new AddOrderCartUniqueIndex1791000000782().up(runner as never)).rejects.toThrow(/Unsupported database/);
		await expect(new AddOrderCartUniqueIndex1791000000782().down(runner as never)).rejects.toThrow(/Unsupported database/);
	});

	it('is the last tick of the plugin’s set, and its name is its class’s', () => {
		expect(ALL_ORDER_MIGRATIONS[ALL_ORDER_MIGRATIONS.length - 1]).toBe(AddOrderCartUniqueIndex1791000000782);
		expect(new AddOrderCartUniqueIndex1791000000782().name).toBe(AddOrderCartUniqueIndex1791000000782.name);
	});
});
