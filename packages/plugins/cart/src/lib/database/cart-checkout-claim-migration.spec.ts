/**
 * The tick that gives a cart its checkout claim (R3-10).
 *
 * Judged, like the set's other column ticks, by what it issues on a recording runner in each state a real
 * installation reaches: the two nullable columns are stated in each dialect's own form where they are
 * missing, nothing is issued where they are already there, `down` drops exactly what `up` added, and a
 * dialect the file has no statements for is refused.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason the package's other suites state.
 */
jest.mock('@gauzy/core', () => ({}));

import { DatabaseTypeEnum } from '@gauzy/config';
import { ALL_CART_MIGRATIONS } from './cart-migrations';
import { AddCartCheckoutClaimColumns1791000000781 } from './migrations/1791000000781-AddCartCheckoutClaimColumns';

/**
 * A query runner that records what a migration asked for.
 *
 * @param state The dialect, and the claim columns the cart table already carries.
 */
function recordingRunner(state: { type: DatabaseTypeEnum; columns?: string[] }) {
	const statements: string[] = [];
	const columns = state.columns ?? [];

	return {
		statements,
		connection: { options: { type: state.type } },
		hasColumn: async (table: string, column: string) => table === 'commerce_cart' && columns.includes(column),
		query: async (sql: string) => {
			statements.push(sql);

			return [];
		}
	};
}

describe('AddCartCheckoutClaimColumns1791000000781 — what it issues', () => {
	it('adds the two nullable claim columns in each dialect’s own form', async () => {
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: [
				'ALTER TABLE "commerce_cart" ADD COLUMN "checkoutClaimId" character varying(36)',
				'ALTER TABLE "commerce_cart" ADD COLUMN "checkoutClaimedAt" TIMESTAMP'
			],
			[DatabaseTypeEnum.sqlite]: [
				'ALTER TABLE "commerce_cart" ADD COLUMN "checkoutClaimId" varchar(36)',
				'ALTER TABLE "commerce_cart" ADD COLUMN "checkoutClaimedAt" datetime'
			],
			[DatabaseTypeEnum.betterSqlite3]: [
				'ALTER TABLE "commerce_cart" ADD COLUMN "checkoutClaimId" varchar(36)',
				'ALTER TABLE "commerce_cart" ADD COLUMN "checkoutClaimedAt" datetime'
			],
			[DatabaseTypeEnum.mysql]: [
				'ALTER TABLE `commerce_cart` ADD COLUMN `checkoutClaimId` varchar(36) NULL',
				'ALTER TABLE `commerce_cart` ADD COLUMN `checkoutClaimedAt` datetime NULL'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const runner = recordingRunner({ type: type as DatabaseTypeEnum });

			await new AddCartCheckoutClaimColumns1791000000781().up(runner as never);

			expect(runner.statements).toEqual(statements);
			// Nullable, and nothing backfilled: a cart nobody is checking out has no claim.
			expect(runner.statements.join('\n')).not.toMatch(/NOT NULL|UPDATE /);
		}
	});

	it('issues nothing on a database that already carries both columns', async () => {
		for (const type of [DatabaseTypeEnum.postgres, DatabaseTypeEnum.sqlite, DatabaseTypeEnum.mysql]) {
			const runner = recordingRunner({ type, columns: ['checkoutClaimId', 'checkoutClaimedAt'] });

			await new AddCartCheckoutClaimColumns1791000000781().up(runner as never);

			expect(runner.statements).toEqual([]);
		}
	});

	it('adds only the missing column when an earlier, interrupted run left one behind', async () => {
		const runner = recordingRunner({ type: DatabaseTypeEnum.postgres, columns: ['checkoutClaimId'] });

		await new AddCartCheckoutClaimColumns1791000000781().up(runner as never);

		expect(runner.statements).toEqual(['ALTER TABLE "commerce_cart" ADD COLUMN "checkoutClaimedAt" TIMESTAMP']);
	});

	it('drops exactly the two columns it adds, on every dialect, and nothing that is already gone', async () => {
		const expected: Record<string, string[]> = {
			[DatabaseTypeEnum.postgres]: [
				'ALTER TABLE "commerce_cart" DROP COLUMN "checkoutClaimedAt"',
				'ALTER TABLE "commerce_cart" DROP COLUMN "checkoutClaimId"'
			],
			[DatabaseTypeEnum.sqlite]: [
				'ALTER TABLE "commerce_cart" DROP COLUMN "checkoutClaimedAt"',
				'ALTER TABLE "commerce_cart" DROP COLUMN "checkoutClaimId"'
			],
			[DatabaseTypeEnum.mysql]: [
				'ALTER TABLE `commerce_cart` DROP COLUMN `checkoutClaimedAt`',
				'ALTER TABLE `commerce_cart` DROP COLUMN `checkoutClaimId`'
			]
		};

		for (const [type, statements] of Object.entries(expected)) {
			const runner = recordingRunner({
				type: type as DatabaseTypeEnum,
				columns: ['checkoutClaimId', 'checkoutClaimedAt']
			});

			await new AddCartCheckoutClaimColumns1791000000781().down(runner as never);

			expect(runner.statements).toEqual(statements);
		}

		const empty = recordingRunner({ type: DatabaseTypeEnum.postgres });

		await new AddCartCheckoutClaimColumns1791000000781().down(empty as never);

		expect(empty.statements).toEqual([]);
	});

	it('refuses a dialect it has no statements for', async () => {
		const runner = recordingRunner({ type: 'oracle' as DatabaseTypeEnum });

		await expect(new AddCartCheckoutClaimColumns1791000000781().up(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
		await expect(new AddCartCheckoutClaimColumns1791000000781().down(runner as never)).rejects.toThrow(
			/Unsupported database/
		);
	});

	it('is the last tick of the plugin’s set, and its name is its class’s', () => {
		expect(ALL_CART_MIGRATIONS[ALL_CART_MIGRATIONS.length - 1]).toBe(AddCartCheckoutClaimColumns1791000000781);
		expect(new AddCartCheckoutClaimColumns1791000000781().name).toBe(AddCartCheckoutClaimColumns1791000000781.name);
	});
});
