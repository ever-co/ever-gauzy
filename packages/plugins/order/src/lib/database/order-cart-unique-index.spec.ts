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
 * R3-10: one cart becomes at most one placed order.
 *
 * `IDX_order_cart` was not unique, so the database accepted a second live order of one cart — which is what
 * two concurrent completions produced. The tick adds `UQ_order_cart` beside it, over the live orders that are
 * neither `DRAFT` nor `CANCELED`, so the draft a failed checkout leaves behind never blocks the next one. Two
 * halves are pinned:
 *
 * - **a real SQLite database** (better-sqlite3): a second placed order of a cart is refused — at the insert
 *   and at the placement of a draft alike — while drafts, cancelled orders, soft-deleted orders and orders of
 *   no cart stay legal; and the tick, run where duplicates already exist, **changes no row and creates
 *   nothing**;
 * - **a recording runner** for the statements each dialect is given (MySQL's generated column included), the
 *   guards and `down`.
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

/** The slice of `order` the index is about, as the create tick declares it on SQLite. */
function orderTable(): BetterSqlite3.Database {
	const db = new Database(':memory:');

	db.exec(
		`CREATE TABLE "order" ("id" varchar PRIMARY KEY NOT NULL, "cartId" varchar, "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "deletedAt" datetime)`
	);
	db.exec(`CREATE INDEX "IDX_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL`);

	return db;
}

const insert = (
	db: BetterSqlite3.Database,
	id: string,
	cartId: string | null,
	status = 'CONFIRMED',
	deletedAt: string | null = null
) =>
	db
		.prepare(`INSERT INTO "order" ("id", "cartId", "status", "deletedAt") VALUES (?, ?, ?, ?)`)
		.run(id, cartId, status, deletedAt);

const indexNamed = (db: BetterSqlite3.Database, name: string) =>
	db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?`).get(name);

describe('AddOrderCartUniqueIndex1791000000782 — on a real SQLite database', () => {
	let warn: jest.SpyInstance;

	beforeEach(() => {
		warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a second placed order of one cart, at the insert and at the placement of a draft', async () => {
		const db = orderTable();

		await new AddOrderCartUniqueIndex1791000000782().up(sqliteRunner(db));

		insert(db, 'order-1', 'cart-1', 'CONFIRMED');
		expect(() => insert(db, 'order-2', 'cart-1', 'PENDING')).toThrow(/UNIQUE/);

		// The race the claim closes, stated at the database: the losing completion's draft cannot be placed.
		insert(db, 'order-3', 'cart-1', 'DRAFT');
		expect(() => db.prepare(`UPDATE "order" SET "status" = 'PENDING' WHERE "id" = 'order-3'`).run()).toThrow(
			/UNIQUE/
		);
	});

	it('keeps drafts, cancelled and soft-deleted orders and orders of no cart legal', async () => {
		const db = orderTable();

		await new AddOrderCartUniqueIndex1791000000782().up(sqliteRunner(db));

		insert(db, 'order-1', 'cart-1', 'CONFIRMED');
		// A failed checkout's leftover draft, and the next attempt's draft, never block the cart.
		insert(db, 'order-2', 'cart-1', 'DRAFT');
		insert(db, 'order-3', 'cart-1', 'DRAFT');
		insert(db, 'order-4', 'cart-1', 'CANCELED');
		insert(db, 'order-5', 'cart-1', 'CONFIRMED', '2026-10-17 00:00:00');
		insert(db, 'order-6', null);
		insert(db, 'order-7', null);

		// `IDX_order_cart` is left exactly where it was: this tick adds, it does not replace.
		expect(indexNamed(db, 'IDX_order_cart')).toBeTruthy();
		expect(indexNamed(db, 'UQ_order_cart')).toBeTruthy();
	});

	it('changes no row and creates nothing where two placed orders already share a cart, and says which', async () => {
		const db = orderTable();

		insert(db, 'order-1', 'cart-1', 'CONFIRMED');
		insert(db, 'order-2', 'cart-1', 'PROCESSING');
		// Not duplicates under the rule: a draft beside a placed order, and two cancelled orders.
		insert(db, 'order-3', 'cart-2', 'CONFIRMED');
		insert(db, 'order-4', 'cart-2', 'DRAFT');
		insert(db, 'order-5', 'cart-3', 'CANCELED');
		insert(db, 'order-6', 'cart-3', 'CANCELED');

		await new AddOrderCartUniqueIndex1791000000782().up(sqliteRunner(db));

		expect(db.prepare(`SELECT COUNT(*) AS "n" FROM "order"`).get()).toEqual({ n: 6 });
		expect(indexNamed(db, 'UQ_order_cart')).toBeUndefined();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('cart-1'));
		expect(warn.mock.calls[0][0]).not.toMatch(/cart-2|cart-3/);
	});

	it('is reversed by down, and down is a no-op once the index is gone', async () => {
		const db = orderTable();
		const migration = new AddOrderCartUniqueIndex1791000000782();

		await migration.up(sqliteRunner(db));
		await migration.down(sqliteRunner(db));
		await migration.down(sqliteRunner(db));

		insert(db, 'order-1', 'cart-1');
		expect(() => insert(db, 'order-2', 'cart-1')).not.toThrow();
		expect(indexNamed(db, 'IDX_order_cart')).toBeTruthy();
	});
});

/**
 * A query runner that records what the tick asked for.
 *
 * @param state The dialect, whether the index (and MySQL's generated column) is already there, and the carts
 * the duplicate probe answers.
 */
function recordingRunner(state: { type: DatabaseTypeEnum; index?: boolean; column?: boolean; duplicates?: string[] }) {
	const statements: string[] = [];

	return {
		statements,
		connection: { options: { type: state.type } },
		hasTable: async (table: string) => table === 'order',
		hasColumn: async (table: string, column: string) =>
			table === 'order' && column === 'placedCartKey' && state.column === true,
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
const ddlOf = (runner: { statements: string[] }): string[] =>
	runner.statements.filter((statement) => !statement.startsWith('SELECT '));

describe('AddOrderCartUniqueIndex1791000000782 — what it issues', () => {
	beforeEach(() => {
		jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('states the rule in each dialect’s own form', async () => {
		const partial = `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL AND "status" NOT IN ('DRAFT', 'CANCELED')`;
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: [partial],
			[DatabaseTypeEnum.sqlite]: [partial],
			[DatabaseTypeEnum.mysql]: [
				"ALTER TABLE `order` ADD COLUMN `placedCartKey` varchar(36) GENERATED ALWAYS AS (IF(`cartId` IS NOT NULL AND `deletedAt` IS NULL AND `status` NOT IN ('DRAFT', 'CANCELED'), `cartId`, NULL)) VIRTUAL",
				'CREATE UNIQUE INDEX `UQ_order_cart` ON `order` (`placedCartKey`)'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const runner = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddOrderCartUniqueIndex1791000000782().up(runner as never);

			expect(ddlOf(runner)).toEqual(statements);
		}
	});

	it('reuses a MySQL generated column an interrupted run left behind', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.mysql, column: true });

		await new AddOrderCartUniqueIndex1791000000782().up(runner as never);

		expect(ddlOf(runner)).toEqual(['CREATE UNIQUE INDEX `UQ_order_cart` ON `order` (`placedCartKey`)']);
	});

	it('probes duplicates under the same rule the index states', async () => {
		for (const type of [DatabaseTypeEnum.postgres, DatabaseTypeEnum.mysql]) {
			const runner = recordingRunner({ type });

			await new AddOrderCartUniqueIndex1791000000782().up(runner as never);

			const probe = runner.statements.find((statement) => /GROUP BY/.test(statement)) ?? '';

			expect(probe).toMatch(/deletedAt.? IS NULL/);
			expect(probe).toMatch(/status.? NOT IN \('DRAFT', 'CANCELED'\)/);
		}
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

	it('drops exactly what it creates, only where it is present', async () => {
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: ['DROP INDEX IF EXISTS "UQ_order_cart"'],
			[DatabaseTypeEnum.sqlite]: ['DROP INDEX IF EXISTS "UQ_order_cart"'],
			[DatabaseTypeEnum.mysql]: [
				'DROP INDEX `UQ_order_cart` ON `order`',
				'ALTER TABLE `order` DROP COLUMN `placedCartKey`'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const present = recordingRunner({ type: type as DatabaseTypeEnum, index: true, column: true });

			await new AddOrderCartUniqueIndex1791000000782().down(present as never);
			expect(ddlOf(present)).toEqual(statements);

			const absent = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddOrderCartUniqueIndex1791000000782().down(absent as never);
			expect(ddlOf(absent)).toEqual([]);
		}
	});

	it('refuses a dialect it has no statements for', async () => {
		const runner = recordingRunner({ type: 'oracle' as DatabaseTypeEnum });

		await expect(new AddOrderCartUniqueIndex1791000000782().up(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
		await expect(new AddOrderCartUniqueIndex1791000000782().down(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
	});

	it('is the last tick of the plugin’s set, and its name is its class’s', () => {
		// Followed by the payment-fact unique index of Q7-W1b, which is the last tick now.
		expect(ALL_ORDER_MIGRATIONS[ALL_ORDER_MIGRATIONS.length - 2]).toBe(AddOrderCartUniqueIndex1791000000782);
		expect(new AddOrderCartUniqueIndex1791000000782().name).toBe(AddOrderCartUniqueIndex1791000000782.name);
	});
});
