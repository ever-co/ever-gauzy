/**
 * The statements `FoldPriceTierNullKeys1791000000437` issues on MySQL, where DDL is not transactional (Greptile, #10596).
 *
 * MySQL commits each DDL statement on its own. Replacing the tier index as `DROP INDEX` followed by `CREATE UNIQUE
 * INDEX` therefore has a window: if the second statement fails — a duplicate written by another process after the
 * collision check — the first has already committed, and the table is left with no tier index at all. One `ALTER
 * TABLE … DROP INDEX …, ADD UNIQUE INDEX …` is applied as a unit: on MySQL 8.0.22 a failing `ADD` leaves the old
 * index in place (checked on a throwaway server; the separate pair left none).
 *
 * The migration runs against a query runner that records the statements and answers the catalogue reads.
 */
jest.mock('@gauzy/config', () => jest.requireActual('@gauzy/config/src/lib/database-helpers'));

import { QueryRunner } from 'typeorm';
import { FoldPriceTierNullKeys1791000000437 } from './migrations/1791000000437-FoldPriceTierNullKeys';

/** A MySQL query runner over a `product_price` that carries `sellerId`, with or without the tier index. */
function mysqlRunner(options: { tierIndex: boolean; sellerKey: boolean }) {
	let statements: string[] = [];
	const runner = {
		connection: { options: { type: 'mysql' } },
		hasTable: async () => true,
		hasColumn: async (_table: string, column: string) => (column === 'sellerKey' ? options.sellerKey : true),
		query: async (sql: string) => {
			statements.push(sql);
			if (/COUNT\(\*\)/.test(sql) && /colliding/.test(sql)) {
				return [{ n: 0 }];
			}
			if (/information_schema\.STATISTICS/i.test(sql)) {
				return options.tierIndex ? [{ n: 1 }] : [{ n: 0 }];
			}
			return [];
		}
	} as unknown as QueryRunner;

	return {
		runner,
		// The DDL that touches the tier index; the catalogue read that asks whether it exists is not part of it.
		statements: () => statements.filter((sql) => /^(ALTER|CREATE|DROP) /.test(sql) && /UQ_price_tier/.test(sql))
	};
}

describe('FoldPriceTierNullKeys1791000000437 on MySQL — the tier index is replaced in one statement', () => {
	let log: jest.SpyInstance;

	beforeEach(() => {
		log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => log.mockRestore());

	it('up drops and recreates UQ_price_tier in one ALTER TABLE, so a failed recreate keeps the old index', async () => {
		const { runner, statements } = mysqlRunner({ tierIndex: true, sellerKey: false });

		await new FoldPriceTierNullKeys1791000000437().up(runner);

		expect(statements()).toEqual([
			'ALTER TABLE `product_price` DROP INDEX `UQ_price_tier`, ADD UNIQUE INDEX `UQ_price_tier` (`variantId`, `currency`, `sellerKey`, `priceListKey`, `minQuantityKey`, `maxQuantityKey`, `deletedKey`)'
		]);
	});

	it('down puts back the index 1791000000435 built, in one ALTER TABLE as well', async () => {
		const { runner, statements } = mysqlRunner({ tierIndex: true, sellerKey: true });

		await new FoldPriceTierNullKeys1791000000437().down(runner);

		expect(statements()).toEqual([
			'ALTER TABLE `product_price` DROP INDEX `UQ_price_tier`, ADD UNIQUE INDEX `UQ_price_tier` (`variantId`, `currency`, `sellerId`, `priceListKey`, `minQuantityKey`, `maxQuantityKey`, `deletedKey`)'
		]);
	});

	it('creates the index when the table carries none, rather than dropping one that is not there', async () => {
		const { runner, statements } = mysqlRunner({ tierIndex: false, sellerKey: true });

		await new FoldPriceTierNullKeys1791000000437().up(runner);

		expect(statements()).toEqual([
			'ALTER TABLE `product_price` ADD UNIQUE INDEX `UQ_price_tier` (`variantId`, `currency`, `sellerKey`, `priceListKey`, `minQuantityKey`, `maxQuantityKey`, `deletedKey`)'
		]);
	});
});
