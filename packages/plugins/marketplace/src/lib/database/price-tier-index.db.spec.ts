/**
 * The price tier's unique index after the marketplace extends it, on a real SQLite database (review R5-13).
 *
 * `CreatePricingTables1791000000120` keys a price tier on `(variantId, currency, COALESCE(priceListId, nil),
 * COALESCE(minQuantity, -1), COALESCE(maxQuantity, -1))` for live rows. The folds are the point: SQLite and
 * PostgreSQL never compare two NULLs equal, so without them a base price (no list, no bounds — the ordinary case)
 * escapes the index and the same tier can be stored twice. `AddMarketplaceAmendmentColumns1791000000435` rebuilt the
 * index with `sellerId` over the **raw** columns, dropping every fold — so neither two platform base prices nor two
 * base prices of one seller were refused any more — and its down put back an unfolded tuple as well.
 *
 * The pricing migrations and the marketplace's run here in the order the application runs them, through a real
 * TypeORM query runner, and the rows below are what `assertTierIsFree` refuses in the service; the index is what
 * backs it against two concurrent or bulk writes.
 */
jest.mock('@gauzy/config', () => jest.requireActual('@gauzy/config/src/lib/database-helpers'));
jest.mock('@gauzy/core', () => ({
	// Only the PostgreSQL and MySQL branches state constraints; the embedded branch never calls it.
	addCheckConstraint: async () => undefined
}));

import 'reflect-metadata';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { CreatePricingTables1791000000120 } from '../../../../pricing/src/lib/database/migrations/1791000000120-CreatePricingTables';
import { AddPriceListForeignKeys1791000000130 } from '../../../../pricing/src/lib/database/migrations/1791000000130-AddPriceListForeignKeys';
import { AddPriceComputationColumns1791000000135 } from '../../../../pricing/src/lib/database/migrations/1791000000135-AddPriceComputationColumns';
import { AddPriceUnitForeignKey1791000000186 } from '../../../../pricing/src/lib/database/migrations/1791000000186-AddPriceUnitForeignKey';
import { AddMarketplaceAmendmentColumns1791000000435 } from './migrations/1791000000435-AddMarketplaceAmendmentColumns';
import { FoldPriceTierNullKeys1791000000437 } from './migrations/1791000000437-FoldPriceTierNullKeys';

/** The migrations that shape `product_price` and its tier index, in the order the application runs them. */
const CHAIN: MigrationInterface[] = [
	new CreatePricingTables1791000000120(),
	new AddPriceListForeignKeys1791000000130(),
	new AddPriceComputationColumns1791000000135(),
	new AddPriceUnitForeignKey1791000000186(),
	new AddMarketplaceAmendmentColumns1791000000435(),
	new FoldPriceTierNullKeys1791000000437()
];

/** The index exactly as the pricing set declares it on the embedded dialect. */
const PRICING_TIER_INDEX = `CREATE UNIQUE INDEX "UQ_price_tier" ON "product_price" ("variantId", "currency", COALESCE("priceListId", '00000000-0000-0000-0000-000000000000'), COALESCE("minQuantity", -1), COALESCE("maxQuantity", -1)) WHERE "deletedAt" IS NULL`;

const VARIANT = '00000000-0000-4000-8000-000000000001';
const LIST = '00000000-0000-4000-8000-000000000002';
const SELLER = '00000000-0000-4000-8000-000000000003';

describe('UQ_price_tier once the marketplace extends it with the seller (R5-13, SQLite)', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	let sequence = 0;

	/** Writes one price row; the columns not named take their defaults. */
	const price = async (row: { sellerId?: string; priceListId?: string; deletedAt?: string; amount?: number }) => {
		sequence += 1;
		await queryRunner.query(
			`INSERT INTO "product_price" ("id", "variantId", "currency", "amount", "sellerId", "priceListId", "deletedAt") VALUES (?, ?, 'USD', ?, ?, ?, ?)`,
			[
				`00000000-0000-4000-9000-${String(sequence).padStart(12, '0')}`,
				VARIANT,
				row.amount ?? 10,
				row.sellerId ?? null,
				row.priceListId ?? null,
				row.deletedAt ?? null
			]
		);
	};
	const tierIndex = async (): Promise<string> =>
		(await queryRunner.query(`SELECT "sql" FROM "sqlite_master" WHERE "name" = 'UQ_price_tier'`))[0]?.sql;

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();

		// The tables the price tables reference, as the platform's own migrations create them (only the key matters).
		for (const table of ['product_variant', 'channel', 'region', 'contact_group', 'unit', 'seller']) {
			await queryRunner.query(`CREATE TABLE "${table}" ("id" varchar PRIMARY KEY NOT NULL)`);
		}
		await queryRunner.query(
			`CREATE TABLE "organization_contact" ("id" varchar PRIMARY KEY NOT NULL, "priceListId" varchar)`
		);
		await queryRunner.query(`INSERT INTO "product_variant" ("id") VALUES (?)`, [VARIANT]);

		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			for (const migration of CHAIN) {
				await migration.up(queryRunner);
			}
		} finally {
			log.mockRestore();
		}
		await queryRunner.query(`INSERT INTO "price_list" ("id", "name", "code") VALUES (?, 'Sale', 'SALE')`, [LIST]);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('refuses a second live platform base price for the same variant and currency', async () => {
		await price({});

		await expect(price({ amount: 12 })).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('refuses a second live base price of the same seller, and accepts a seller price beside the platform’s', async () => {
		await price({});
		await price({ sellerId: SELLER });

		await expect(price({ sellerId: SELLER, amount: 12 })).rejects.toThrow(/UNIQUE constraint failed/);
	});

	it('control: a soft-deleted row and a price on a list are not the same tier as the live base price', async () => {
		await price({});
		await price({ deletedAt: '2026-01-01 00:00:00' });
		await price({ priceListId: LIST });

		expect(Number((await queryRunner.query(`SELECT COUNT(*) AS "n" FROM "product_price"`))[0].n)).toBe(3);
	});

	it('stops, naming the collision, rather than choosing between rows that already hold one tier twice', async () => {
		const fold = CHAIN[CHAIN.length - 1];
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			// The state an installation that ran only `1791000000435` can be in: two live base prices of one tier.
			await fold.down(queryRunner);
			await price({});
			await price({ amount: 12 });

			await expect(fold.up(queryRunner)).rejects.toThrow(
				'1 price tier(s) are held by more than one live product_price row'
			);
		} finally {
			log.mockRestore();
		}

		expect(Number((await queryRunner.query(`SELECT COUNT(*) AS "n" FROM "product_price"`))[0].n)).toBe(2);
		expect(await tierIndex()).toContain('"sellerId", "priceListId", "minQuantity", "maxQuantity"');
	});

	it('reverting the marketplace puts back the tuple the pricing set declared, folds included', async () => {
		const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			// The marketplace migrations, newest first, as a revert walks them.
			for (const migration of CHAIN.slice(4).reverse()) {
				await migration.down(queryRunner);
			}
		} finally {
			log.mockRestore();
		}

		expect(await tierIndex()).toBe(PRICING_TIER_INDEX);
	});
});
