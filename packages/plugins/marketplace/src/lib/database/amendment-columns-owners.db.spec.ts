/**
 * The seller columns the marketplace amends onto other packages' tables, on a real SQLite database (review R5-14).
 *
 * `AddMarketplaceAmendmentColumns1791000000435` is the only migration that created `adjustment.fundedBy`/`sellerId`,
 * `product_price.sellerId`, `promotion.fundingType`/`sellerFundingShare`/`sellerId`, `fulfillment.sellerId` and
 * `order_return.sellerId` — yet the kernel's `Adjustment`, pricing's `ProductPrice`, `Promotion`, `Fulfillment` and
 * `OrderReturn` all declare them. The worker hosts the kernel and pricing without the marketplace, so its ORM mapped
 * columns its own migrations never created, and every read or write of those rows failed with "no such column".
 *
 * Each case runs the packages' own migrations, in timestamp order, through a real TypeORM query runner: an
 * installation **without** the marketplace (the worker's), and one **with** it (the API's), where the marketplace's
 * tick runs first and the owners' ticks must be no-ops.
 */
jest.mock('@gauzy/config', () => jest.requireActual('@gauzy/config/src/lib/database-helpers'));
jest.mock('@gauzy/core', () => ({
	// Only the PostgreSQL and MySQL branches state constraints; the embedded branch never calls it.
	addCheckConstraint: async () => undefined
}));

import 'reflect-metadata';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { CreateAdjustmentTables1791000000060 } from '../../../../../core/src/lib/database/migrations/1791000000060-CreateAdjustmentTables';
import { AddAdjustmentSellerColumns1791000000651 } from '../../../../../core/src/lib/database/migrations/1791000000651-AddAdjustmentSellerColumns';
import { CreatePricingTables1791000000120 } from '../../../../pricing/src/lib/database/migrations/1791000000120-CreatePricingTables';
import { AddPriceComputationColumns1791000000135 } from '../../../../pricing/src/lib/database/migrations/1791000000135-AddPriceComputationColumns';
import { AddProductPriceSellerColumn1791000000652 } from '../../../../pricing/src/lib/database/migrations/1791000000652-AddProductPriceSellerColumn';
import { CreatePromotionTables1791000000260 } from '../../../../promotion/src/lib/migrations/1791000000260-CreatePromotionTables';
import { AddPromotionFundingColumns1791000000653 } from '../../../../promotion/src/lib/migrations/1791000000653-AddPromotionFundingColumns';
import { CreateFulfillmentTables1791000000240 } from '../../../../fulfillment/src/lib/database/migrations/1791000000240-CreateFulfillmentTables';
import { AddFulfillmentSellerColumn1791000000654 } from '../../../../fulfillment/src/lib/database/migrations/1791000000654-AddFulfillmentSellerColumn';
import { CreateReturnTables1791000000300 } from '../../../../returns/src/lib/database/migrations/1791000000300-CreateReturnTables';
import { AddOrderReturnSellerColumn1791000000655 } from '../../../../returns/src/lib/database/migrations/1791000000655-AddOrderReturnSellerColumn';
import { AddMarketplaceAmendmentColumns1791000000435 } from './migrations/1791000000435-AddMarketplaceAmendmentColumns';

/** The tables each package's create tick makes, in timestamp order. */
const CREATES: MigrationInterface[] = [
	new CreateAdjustmentTables1791000000060(),
	new CreatePricingTables1791000000120(),
	new AddPriceComputationColumns1791000000135(),
	new CreateFulfillmentTables1791000000240(),
	new CreatePromotionTables1791000000260(),
	new CreateReturnTables1791000000300()
];

/** The owners' ticks that create the columns their entities declare. */
const OWNERS: MigrationInterface[] = [
	new AddAdjustmentSellerColumns1791000000651(),
	new AddProductPriceSellerColumn1791000000652(),
	new AddPromotionFundingColumns1791000000653(),
	new AddFulfillmentSellerColumn1791000000654(),
	new AddOrderReturnSellerColumn1791000000655()
];

/** Every column the marketplace amends onto another package's table, by table. */
const AMENDED: Record<string, string[]> = {
	adjustment: ['fundedBy', 'sellerId'],
	product_price: ['sellerId'],
	promotion: ['fundingType', 'sellerFundingShare', 'sellerId'],
	fulfillment: ['sellerId'],
	order_return: ['sellerId']
};

describe('the seller columns exist wherever the entities that declare them are hosted (R5-14, SQLite)', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const run = async (migrations: MigrationInterface[], direction: 'up' | 'down' = 'up') => {
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			for (const migration of migrations) {
				await migration[direction](queryRunner);
			}
		} finally {
			log.mockRestore();
		}
	};
	const columnsOf = async (table: string): Promise<string[]> =>
		((await queryRunner.query(`PRAGMA table_info("${table}")`)) as Array<{ name: string }>).map(
			(column) => column.name
		);
	const missing = async (): Promise<string[]> => {
		let absent: string[] = [];
		for (const [table, columns] of Object.entries(AMENDED)) {
			const present = await columnsOf(table);
			absent = [
				...absent,
				...columns.filter((column) => !present.includes(column)).map((column) => `${table}.${column}`)
			];
		}
		return absent;
	};

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await run(CREATES);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('an installation without the marketplace (the worker) gets every column its entities declare', async () => {
		await run(OWNERS);

		expect(await missing()).toEqual([]);
	});

	it('the owners create the column the marketplace defines: the defaults a row written before it reads', async () => {
		await run(OWNERS);

		const promotion = (await queryRunner.query(`PRAGMA table_info("promotion")`)) as Array<{
			name: string;
			dflt_value: string;
			notnull: number;
		}>;
		const adjustment = (await queryRunner.query(`PRAGMA table_info("adjustment")`)) as Array<{
			name: string;
			dflt_value: string;
			notnull: number;
		}>;
		const pick = (rows: typeof promotion, name: string) => rows.find((row) => row.name === name);

		expect(pick(promotion, 'fundingType')).toMatchObject({ dflt_value: "'PLATFORM'", notnull: 1 });
		expect(pick(promotion, 'sellerFundingShare')).toMatchObject({ dflt_value: '0', notnull: 1 });
		expect(pick(adjustment, 'fundedBy')).toMatchObject({ dflt_value: "'PLATFORM'", notnull: 1 });
		expect(pick(adjustment, 'sellerId')).toMatchObject({ notnull: 0 });
	});

	it('with the marketplace, its tick adds the columns first and the owners’ ticks are no-ops', async () => {
		await run([new AddMarketplaceAmendmentColumns1791000000435()]);
		const before = Object.fromEntries(
			await Promise.all(Object.keys(AMENDED).map(async (table) => [table, await columnsOf(table)]))
		);

		await run(OWNERS);

		expect(await missing()).toEqual([]);
		for (const table of Object.keys(AMENDED)) {
			expect({ table, columns: await columnsOf(table) }).toEqual({ table, columns: before[table] });
		}
	});

	it('a second run of the owners’ ticks changes nothing, and their down keeps the embedded dialect’s columns', async () => {
		await run(OWNERS);
		await run(OWNERS);
		await run([...OWNERS].reverse(), 'down');

		expect(await missing()).toEqual([]);
	});
});
