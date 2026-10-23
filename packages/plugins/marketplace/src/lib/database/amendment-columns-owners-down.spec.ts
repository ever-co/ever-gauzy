/**
 * The PostgreSQL and MySQL branches of the five owners' seller-column ticks (review R5-14; Greptile, #10605).
 *
 * The SQLite suite beside this one runs the ticks on a real database, but the embedded dialect keeps every additive
 * column, so it never reaches the rule the server dialects' down depends on: the columns are dropped only where the
 * marketplace's `AddMarketplaceAmendmentColumns1791000000435` has **not** run — there they are the tick's alone —
 * and kept where it has, because the marketplace's foreign key, indexes and rules sit on them. Each tick runs here
 * against a query runner that keeps the table's columns and the migrations table's rows, on both server dialects,
 * with the marketplace's history row present and absent.
 */
jest.mock('@gauzy/config', () => jest.requireActual('@gauzy/config/src/lib/database-helpers'));

import { MigrationInterface, QueryRunner } from 'typeorm';
import { AddAdjustmentSellerColumns1791000000651 } from '../../../../../core/src/lib/database/migrations/1791000000651-AddAdjustmentSellerColumns';
import { AddProductPriceSellerColumn1791000000652 } from '../../../../pricing/src/lib/database/migrations/1791000000652-AddProductPriceSellerColumn';
import { AddPromotionFundingColumns1791000000653 } from '../../../../promotion/src/lib/migrations/1791000000653-AddPromotionFundingColumns';
import { AddFulfillmentSellerColumn1791000000654 } from '../../../../fulfillment/src/lib/database/migrations/1791000000654-AddFulfillmentSellerColumn';
import { AddOrderReturnSellerColumn1791000000655 } from '../../../../returns/src/lib/database/migrations/1791000000655-AddOrderReturnSellerColumn';

type Dialect = 'postgres' | 'mysql';

/** Each tick, the table it amends and the columns it owns, in the order it adds them. */
const TICKS: Array<{ make: () => MigrationInterface; table: string; columns: string[] }> = [
	{
		make: () => new AddAdjustmentSellerColumns1791000000651(),
		table: 'adjustment',
		columns: ['fundedBy', 'sellerId']
	},
	{ make: () => new AddProductPriceSellerColumn1791000000652(), table: 'product_price', columns: ['sellerId'] },
	{
		make: () => new AddPromotionFundingColumns1791000000653(),
		table: 'promotion',
		columns: ['fundingType', 'sellerFundingShare', 'sellerId']
	},
	{ make: () => new AddFulfillmentSellerColumn1791000000654(), table: 'fulfillment', columns: ['sellerId'] },
	{ make: () => new AddOrderReturnSellerColumn1791000000655(), table: 'order_return', columns: ['sellerId'] }
];

/** The definitions `1791000000435` adds, per dialect. */
const DEFINITIONS: Record<Dialect, Record<string, string>> = {
	postgres: {
		fundedBy: `varchar(16) NOT NULL DEFAULT 'PLATFORM'`,
		fundingType: `varchar(16) NOT NULL DEFAULT 'PLATFORM'`,
		sellerFundingShare: 'numeric(9,6) NOT NULL DEFAULT 0',
		sellerId: 'uuid'
	},
	mysql: {
		fundedBy: `varchar(16) NOT NULL DEFAULT 'PLATFORM'`,
		fundingType: `varchar(16) NOT NULL DEFAULT 'PLATFORM'`,
		sellerFundingShare: 'numeric(9,6) NOT NULL DEFAULT 0',
		sellerId: 'varchar(36) NULL'
	}
};

/**
 * A server-dialect query runner over one table and the migrations table.
 *
 * `ALTER TABLE … ADD COLUMN` and `… DROP COLUMN` move the column set, and the migrations table answers whether the
 * marketplace's tick is recorded.
 */
function serverRunner(dialect: Dialect, table: string, options: { marketplaceRan: boolean; columns?: string[] }) {
	let columns = new Set<string>(options.columns ?? []);
	let statements: string[] = [];
	const quote = dialect === 'mysql' ? '`' : '"';
	const runner = {
		connection: { options: { type: dialect } },
		hasTable: async (name: string) => name === table || name === 'migrations',
		hasColumn: async (name: string, column: string) => name === table && columns.has(column),
		query: async (sql: string, parameters: unknown[] = []) => {
			statements.push(sql);
			const added = new RegExp(`^ALTER TABLE ${quote}${table}${quote} ADD COLUMN ${quote}(\\w+)${quote} `).exec(
				sql
			);
			const dropped = new RegExp(
				`^ALTER TABLE ${quote}${table}${quote} DROP COLUMN ${quote}(\\w+)${quote}$`
			).exec(sql);

			if (added) {
				columns.add(added[1]);
			} else if (dropped) {
				columns.delete(dropped[1]);
			} else if (/FROM [`"]migrations[`"]/.test(sql)) {
				return options.marketplaceRan && parameters[0] === 'AddMarketplaceAmendmentColumns1791000000435'
					? [{ '1': 1 }]
					: [];
			}
			return [];
		}
	} as unknown as QueryRunner;

	return { runner, columns: () => [...columns], statements: () => statements };
}

describe('the owners’ seller-column ticks on PostgreSQL and MySQL (R5-14)', () => {
	let log: jest.SpyInstance;

	beforeEach(() => {
		log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => log.mockRestore());

	for (const dialect of ['postgres', 'mysql'] as Dialect[]) {
		const q = dialect === 'mysql' ? '`' : '"';

		for (const tick of TICKS) {
			const label = `${dialect}: ${tick.table}`;

			it(`${label} — up adds each missing column with 1791000000435's definition, and a second up adds nothing`, async () => {
				const { runner, columns, statements } = serverRunner(dialect, tick.table, { marketplaceRan: false });
				const migration = tick.make();

				await migration.up(runner);
				await migration.up(runner);

				expect(columns()).toEqual(tick.columns);
				expect(statements().filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual(
					tick.columns.map(
						(column) =>
							`ALTER TABLE ${q}${tick.table}${q} ADD COLUMN ${q}${column}${q} ${DEFINITIONS[dialect][column]}`
					)
				);
			});

			it(`${label} — down drops the columns where the marketplace's tick has not run (they are this tick's alone)`, async () => {
				const { runner, columns, statements } = serverRunner(dialect, tick.table, { marketplaceRan: false });
				const migration = tick.make();

				await migration.up(runner);
				await migration.down(runner);

				expect(columns()).toEqual([]);
				expect(statements().filter((sql) => / DROP COLUMN /.test(sql))).toEqual(
					[...tick.columns]
						.reverse()
						.map((column) => `ALTER TABLE ${q}${tick.table}${q} DROP COLUMN ${q}${column}${q}`)
				);
			});

			it(`${label} — down keeps the columns where the marketplace's tick has run (its constraints sit on them)`, async () => {
				const { runner, columns, statements } = serverRunner(dialect, tick.table, {
					marketplaceRan: true,
					columns: [...tick.columns]
				});
				const migration = tick.make();

				await migration.up(runner);
				await migration.down(runner);

				expect(columns()).toEqual(tick.columns);
				expect(statements().filter((sql) => sql.startsWith('ALTER TABLE'))).toEqual([]);
			});
		}
	}
});
