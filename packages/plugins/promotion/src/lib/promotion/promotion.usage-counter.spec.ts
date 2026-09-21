import { BadRequestException } from '@nestjs/common';
import { RequestContext } from '@gauzy/core';
import { PromotionService } from './promotion.service';
import { PromotionUsageService } from '../promotion-usage/promotion-usage.service';
import { PromotionUsageStatus } from '../promotion.types';

/**
 * `promotion.usageCount`: the counter `usageLimit` is enforced against.
 *
 * **It was incremented by nothing at all.** `isEligible` excludes a promotion whose `usageCount` has
 * reached its `usageLimit`, and a repository-wide search for a write to that column found the two
 * literal initialisations of *coupon* rows and nothing else — so a promotion created with
 * `usageLimit: 100` read zero on every evaluation for ever, was applied an unbounded number of times,
 * and never raised `USAGE_LIMIT_EXCEEDED`. The cap advertised on the entity, in the DTOs and in the
 * GraphQL schema was silently a no-op on every database and both ORMs.
 *
 * What this suite pins is the statement rather than the arithmetic, because the statement is the
 * whole guarantee:
 *
 * - the increment and the ceiling check are **one** conditional `UPDATE`, so two concurrent checkouts
 *   cannot both take the last use;
 * - it carries the caller's tenant and the soft-delete predicate, because a statement that names only
 *   an identifier is one another tenant's identifier can satisfy;
 * - it reaches the driver **positionally** — nothing below `QueryBuilder` substitutes a `:name`, and
 *   a statement full of colons is a syntax error on Postgres and MySQL and binds nothing on either
 *   SQLite driver;
 * - the affected-row count is read through the kernel's own reader, so the five shapes the drivers
 *   answer a write with are all understood; reading one of them is how a write that landed gets
 *   reported to the caller as a refusal.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const PROMOTION = '00000000-0000-4000-8000-0000000000b0';
const CART = '00000000-0000-4000-8000-0000000000b1';

/** What one call to the repository's raw `query` was handed. */
interface IStatement {
	sql: string;
	parameters: unknown[];
}

/**
 * Builds the promotion service over doubles of everything it writes through.
 *
 * @param options.affected What the driver reports the conditional statement changed.
 * @param options.reservations The redemption rows the ledger already holds.
 * @returns The service, the statements it issued and the ledger rows.
 */
function serviceUnderTest(
	options: { affected?: unknown; reservations?: Array<Record<string, unknown>> } = {}
) {
	const statements: IStatement[] = [];
	const rows = options.reservations ?? [];
	const promotionRepository = {
		query: async (sql: string, parameters: unknown[]) => {
			statements.push({ sql, parameters });

			return options.affected ?? { affected: 1 };
		},
		findOneBy: async () => ({ id: PROMOTION, tenantId: TENANT, organizationId: ORG, usageCount: 0 }),
		find: async () => [],
		update: async () => ({ affected: 1 })
	};
	const usageRepository = {
		find: async () => rows,
		findOneBy: async (where?: Record<string, unknown>) =>
			rows.find((row) =>
				Object.entries(where ?? {}).every(
					([field, expected]) => expected === undefined || String(row[field] ?? '') === String(expected)
				)
			) ?? null,
		count: async () => rows.length,
		create: (partial: Record<string, unknown>) => ({ id: `usage-${rows.length + 1}`, ...partial }),
		save: async (entity: Record<string, unknown>) => {
			rows.push(entity);

			return entity;
		},
		update: async (criteria: unknown, partial: Record<string, unknown>) => {
			const id = typeof criteria === 'string' ? criteria : (criteria as { id?: string })?.id;
			const row = rows.find((one) => String(one.id ?? '') === String(id ?? ''));

			if (row) {
				Object.assign(row, partial);
			}

			return { affected: row ? 1 : 0 };
		}
	};

	const service = new PromotionService(
		promotionRepository as never,
		{} as never,
		{ findByPromotion: async () => [] } as never,
		new PromotionUsageService(usageRepository as never, {} as never),
		{} as never,
		{} as never,
		{ publish: async () => undefined } as never
	);

	return { service, statements, rows };
}

describe('PromotionService.consume — the statement that makes a usage limit enforceable', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('increments and checks the ceiling in one conditional statement', async () => {
		const { service, statements } = serviceUnderTest();

		expect(await service.consume(PROMOTION)).toBe(true);
		expect(statements).toHaveLength(1);

		const { sql } = statements[0];

		// One statement: the comparison and the write, with no window between deciding and acting.
		expect(sql).toMatch(/^UPDATE /);
		expect(sql).toMatch(/SET .?usageCount.? = .?usageCount.? \+ 1/);
		expect(sql).toMatch(/usageLimit.? IS NULL OR .?usageCount.? < .?usageLimit/);
	});

	it('carries the caller tenant and the soft-delete predicate', async () => {
		const { service, statements } = serviceUnderTest();

		await service.consume(PROMOTION);

		const { sql, parameters } = statements[0];

		expect(sql).toMatch(/tenantId/);
		expect(sql).toMatch(/deletedAt.? IS NULL/);
		expect(parameters).toEqual([PROMOTION, TENANT]);
	});

	it('reaches the driver positionally, with no named parameter left in it', async () => {
		// Nothing below `QueryBuilder` substitutes a `:name`: Postgres raises a syntax error at the
		// colon, MySQL raises a parser error, and neither SQLite driver can bind an array to a
		// statement that declares no placeholder.
		const { service, statements } = serviceUnderTest();

		await service.consume(PROMOTION);

		const { sql, parameters } = statements[0];

		expect(sql).not.toMatch(/:\w+/);
		// One placeholder per bound value, in the order the values are given.
		expect(sql.match(/\$\d+|\?/g) ?? []).toHaveLength(parameters.length);
	});

	it('refuses the use when the ceiling matched no row', async () => {
		// Zero affected rows is the ceiling's refusal, and it has to read as one on every driver.
		const { service } = serviceUnderTest({ affected: { affected: 0 } });

		expect(await service.consume(PROMOTION)).toBe(false);
	});

	it('reads the affected-row count in each shape a driver answers with', async () => {
		// `pg` answers `{ rowCount }`; TypeORM's raw query on MySQL and SQLite answers
		// `[rows, affected]`; the MySQL driver answers `[ResultSetHeader]`; `better-sqlite3` answers
		// `{ changes }`. A service that understands one of them reports a write that landed as a
		// refusal on the other four.
		for (const shape of [{ rowCount: 1 }, [[], 1], [{ affectedRows: 1 }], { changes: 1 }, 1]) {
			const { service } = serviceUnderTest({ affected: shape });

			expect(await service.consume(PROMOTION)).toBe(true);
		}

		for (const shape of [{ rowCount: 0 }, [[], 0], [{ affectedRows: 0 }], { changes: 0 }, 0]) {
			const { service } = serviceUnderTest({ affected: shape });

			expect(await service.consume(PROMOTION)).toBe(false);
		}
	});
});

describe('PromotionService.reserveUsage — the ledger and the counter move together', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('takes one use for a new reservation', async () => {
		const { service, statements, rows } = serviceUnderTest();

		const usage = await service.reserveUsage({
			promotionId: PROMOTION,
			cartId: CART,
			amount: '5.000000',
			currency: 'USD'
		});

		expect(usage.status).toBe(PromotionUsageStatus.RESERVED);
		expect(rows).toHaveLength(1);
		expect(statements).toHaveLength(1);
	});

	it('takes nothing further for a reservation the cart already holds', async () => {
		// A cart is recalculated on every edit. Counting each recalculation would spend the promotion's
		// whole limit on one buyer changing their mind.
		const { service, statements } = serviceUnderTest({
			reservations: [
				{
					id: 'usage-1',
					tenantId: TENANT,
					organizationId: ORG,
					promotionId: PROMOTION,
					cartId: CART,
					amount: '5.000000',
					currency: 'USD',
					status: PromotionUsageStatus.RESERVED
				}
			]
		});

		await service.reserveUsage({ promotionId: PROMOTION, cartId: CART, amount: '6.000000', currency: 'USD' });

		expect(statements).toHaveLength(0);
	});

	it('gives the reservation back when the ceiling refuses the use', async () => {
		// A reservation nobody may redeem would hold budget and count against the per-customer limit
		// for ever, so it is released rather than left behind.
		const { service, rows } = serviceUnderTest({ affected: { affected: 0 } });

		await expect(
			service.reserveUsage({ promotionId: PROMOTION, cartId: CART, amount: '5.000000', currency: 'USD' })
		).rejects.toBeInstanceOf(BadRequestException);

		expect(rows).toHaveLength(1);
		expect(rows[0].status).toBe(PromotionUsageStatus.REVERTED);
	});
});
