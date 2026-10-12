/**
 * Which ORM the package's read seams answer from, and what a statement looks like by the time a
 * driver sees it.
 *
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module
 * boundary as every other suite in this package does. The two members that matter here are doubled
 * **faithfully**, because they are what the assertions are about: `getORMType` answers whatever the
 * case configured, and the dialect helpers behave the way
 * `packages/core/src/lib/database/database.helper.ts` behaves for the dialect the case configured —
 * a statement is left alone unless the dialect is MySQL, and a named parameter becomes `$n` on
 * Postgres and `?` everywhere else.
 */
const mockOrm = { type: 'typeorm' };
const mockDialect = { type: 'better-sqlite3' };

jest.mock('@gauzy/core', () => ({
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	getORMType: () => mockOrm.type,
	prepareSQLQuery: (sql: string) => (mockDialect.type === 'mysql' ? sql.replace(/"/g, '`') : sql),
	toPositionalStatement: (sql: string, parameters: Record<string, unknown>) => {
		const values: unknown[] = [];
		const positional = sql.replace(/(?<!:):(\w+)\b/g, (match: string, name: string) => {
			if (!Object.prototype.hasOwnProperty.call(parameters ?? {}, name)) {
				return match;
			}

			values.push(parameters[name]);

			return mockDialect.type === 'postgres' ? `$${values.length}` : '?';
		});

		return { sql: positional, parameters: values };
	}
}));

import { InventoryOrmConnection } from './inventory.connection';

/**
 * The read connection of the inventory seams.
 *
 * Three properties are worth pinning, and all three are the reason the class exists:
 *
 * - **the configured ORM is the one that reads**, and the other is the fallback, so an installation
 *   that started both connections still reads through the one it writes with;
 * - **a statement is rewritten for the configured dialect before a driver sees it** — the identifiers
 *   for MySQL, which reads a double quote as a string literal, and the named parameters into the
 *   positional form the driver binds, because nothing below `QueryBuilder` substitutes a `:name`;
 * - **a connection that is not there is named rather than answered with an empty page**, because an
 *   empty page reads as "this variant is not stocked anywhere".
 */

/** A stand-in for the TypeORM data source: it records what it was asked and answers rows. */
function typeOrmDouble(rows: unknown = []) {
	const asked: Array<{ sql: string; parameters: unknown[] }> = [];

	return {
		asked,
		dataSource: {
			query: async (sql: string, parameters: unknown[]) => {
				asked.push({ sql, parameters });

				return rows;
			}
		}
	};
}

/** A stand-in for the MikroORM instance: the same record, reached through its own connection. */
function mikroOrmDouble(rows: unknown = []) {
	const asked: Array<{ sql: string; parameters: unknown[] }> = [];
	const forks: number[] = [];

	return {
		asked,
		forks,
		mikroOrm: {
			em: {
				getConnection: () => ({
					execute: async (sql: string, parameters: unknown[]) => {
						asked.push({ sql, parameters });

						return rows;
					}
				}),
				fork: () => {
					forks.push(forks.length + 1);

					return { find: async () => [] };
				}
			}
		}
	};
}

describe('InventoryOrmConnection — which ORM answers a read', () => {
	beforeEach(() => {
		mockOrm.type = 'typeorm';
		mockDialect.type = 'better-sqlite3';
	});

	it('reads through the configured ORM when both connections are present', async () => {
		const typeorm = typeOrmDouble([{ quantity: '4.000000' }]);
		const mikro = mikroOrmDouble([{ quantity: '99.000000' }]);
		const connection = new InventoryOrmConnection(typeorm.dataSource as never, mikro.mikroOrm as never);

		expect(connection.usesMikroOrm).toBe(false);
		await expect(connection.rows('SELECT 1')).resolves.toEqual([{ quantity: '4.000000' }]);
		expect(mikro.asked).toEqual([]);

		mockOrm.type = 'mikro-orm';

		const other = new InventoryOrmConnection(typeorm.dataSource as never, mikro.mikroOrm as never);

		expect(other.usesMikroOrm).toBe(true);
		await expect(other.rows('SELECT 1')).resolves.toEqual([{ quantity: '99.000000' }]);
	});

	it('falls back to the ORM it has when the configured one was not injected', async () => {
		// An installation whose `DB_ORM` names one ORM while only the other connection was started
		// still reads: the alternative is a seam that answers nothing on a database that is right there.
		const mikro = mikroOrmDouble([{ quantity: '1.000000' }]);
		const connection = new InventoryOrmConnection(undefined, mikro.mikroOrm as never);

		expect(connection.usesMikroOrm).toBe(true);
		await expect(connection.rows('SELECT 1')).resolves.toEqual([{ quantity: '1.000000' }]);

		mockOrm.type = 'mikro-orm';

		const typeorm = typeOrmDouble([{ quantity: '2.000000' }]);
		const other = new InventoryOrmConnection(typeorm.dataSource as never, undefined);

		expect(other.usesMikroOrm).toBe(false);
		await expect(other.rows('SELECT 1')).resolves.toEqual([{ quantity: '2.000000' }]);
	});

	it('binds named parameters in the form the configured driver reads, on either ORM', async () => {
		// `Repository.query()`, `EntityManager.query()` and MikroORM's `Connection.execute()` all hand
		// the statement to the driver untouched, and no driver the platform supports understands
		// `:name`: Postgres and MySQL raise at the colon, and the embedded drivers refuse a statement
		// that declares no placeholder the values array can fill.
		const typeorm = typeOrmDouble();
		const connection = new InventoryOrmConnection(typeorm.dataSource as never, undefined);

		await connection.rows('SELECT * FROM "stock_movement" WHERE "warehouseId" = :warehouseId AND "variantId" = :variantId', {
			warehouseId: 'warehouse-1',
			variantId: 'variant-1'
		});

		expect(typeorm.asked[0].sql).toContain('"warehouseId" = ?');
		expect(typeorm.asked[0].parameters).toEqual(['warehouse-1', 'variant-1']);

		mockDialect.type = 'postgres';
		await connection.rows('SELECT 1 WHERE "id" = :id', { id: 'a' });

		expect(typeorm.asked[1].sql).toContain('"id" = $1');
		expect(typeorm.asked[1].parameters).toEqual(['a']);

		// MySQL reads a double-quoted token as a string literal rather than as a column, so the
		// identifiers are rewritten before the driver sees them.
		mockDialect.type = 'mysql';
		await connection.rows('SELECT "quantity" FROM "stock_movement" WHERE "id" = :id', { id: 'a' });

		expect(typeorm.asked[2].sql).toContain('`quantity`');
		expect(typeorm.asked[2].sql).toContain('`id` = ?');
	});

	it('normalises a driver that answers one row rather than an array', async () => {
		const typeorm = typeOrmDouble({ quantity: '7.000000' });
		const connection = new InventoryOrmConnection(typeorm.dataSource as never, undefined);

		await expect(connection.rows('SELECT 1')).resolves.toEqual([{ quantity: '7.000000' }]);

		const empty = new InventoryOrmConnection(typeOrmDouble(null).dataSource as never, undefined);

		await expect(empty.rows('SELECT 1')).resolves.toEqual([]);
	});

	it('forks the MikroORM entity manager rather than reading through the shared one', async () => {
		// A seam is reached from inside a request on one path and from a queue consumer on another, and
		// MikroORM refuses context-specific calls on the global instance; a fork also keeps a sweep over
		// every level of a location from accumulating an identity map that outlives the answer.
		mockOrm.type = 'mikro-orm';
		const mikro = mikroOrmDouble();
		const connection = new InventoryOrmConnection(undefined, mikro.mikroOrm as never);

		connection.fork();
		connection.fork();

		expect(mikro.forks).toHaveLength(2);
	});

	it('names a missing connection rather than answering with an empty page', async () => {
		const connection = new InventoryOrmConnection(undefined, undefined);

		expect(connection.usesMikroOrm).toBe(false);
		await expect(connection.rows('SELECT 1')).rejects.toThrow(/INVENTORY_NO_CONNECTION/);
		expect(() => connection.fork()).toThrow(/INVENTORY_NO_CONNECTION/);
	});
});
