import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Money, RequestContext } from '@gauzy/core';
import { PromotionUsageService } from './promotion-usage.service';
import { PromotionUsageStatus, RevertOnReturnPolicy } from '../promotion.types';

/**
 * The redemption ledger: one row per application of a promotion, and the lifecycle it moves through.
 *
 * The properties asserted here are the ones that stop a promotion being counted twice or reverted
 * twice (doc 08 §14.1–§14.5):
 *
 * - a reservation is idempotent per `(promotionId, cartId)`, so a cart recalculated on every write
 *   does not leak budget;
 * - registering an order increments nothing, because the reservation already counted, so a replayed
 *   checkout is not double-counted;
 * - a reversal never returns more than was registered, and a second reversal of the same row is a
 *   no-op;
 * - the per-customer count ignores reverted rows, so a customer who cancelled is not blocked by
 *   their own history.
 *
 * The cases at the end are the ones a defect was found by; each names the source and the rule it
 * broke.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const PROMOTION = '00000000-0000-4000-8000-0000000000b0';
const CART = '00000000-0000-4000-8000-0000000000b1';
const ORDER = '00000000-0000-4000-8000-0000000000b2';
const CUSTOMER = '00000000-0000-4000-8000-000000000060';

const AT = new Date('2026-01-15T12:00:00.000Z');

interface IUsageRow {
	id: string;
	tenantId: string;
	organizationId: string;
	promotionId: string;
	couponId?: string;
	cartId?: string;
	orderId?: string;
	customerId?: string;
	code?: string;
	amount: string;
	currency: string;
	usedAt: Date;
	status: PromotionUsageStatus;
}

const usage = (overrides: Partial<IUsageRow> & { id: string }): IUsageRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	promotionId: PROMOTION,
	amount: '25.000000',
	currency: 'USD',
	usedAt: AT,
	status: PromotionUsageStatus.RESERVED,
	...overrides
});

/** A `where` clause, or the array of them TypeORM reads as a disjunction. */
function matches(row: object, where: Record<string, unknown> | Array<Record<string, unknown>> | undefined): boolean {
	if (Array.isArray(where)) {
		return where.some((one) => matches(row, one));
	}

	const fields = row as Record<string, unknown>;

	return Object.entries(where ?? {}).every(([field, expected]) => {
		const value = fields[field];

		if (expected instanceof FindOperator) {
			switch (expected.type) {
				case 'in':
					return (expected.value as unknown[]).some((one) => same(one, value));
				case 'isNull':
					return value === null || value === undefined;
				default:
					throw new Error(`the in-memory double does not implement the "${expected.type}" operator`);
			}
		}

		if (Array.isArray(expected)) {
			return expected.some((one) => same(one, value));
		}

		return expected === undefined || same(expected, value);
	});
}

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

/**
 * What a write addresses, as a conditions object.
 *
 * Every write of these services is scoped to the caller's tenant, so the criteria that reaches the
 * repository is `{ id, tenantId }` rather than a bare identifier — which is the whole point of the
 * scoping: a statement that names only an identifier is one another tenant's identifier can satisfy.
 * A double that understood only the identifier form would report a scoped write as having changed a
 * row it never matched.
 *
 * @param criteria What the service addressed the row by.
 * @returns The same thing as a conditions object.
 */
function criteriaOf(criteria: unknown): Record<string, unknown> {
	if (typeof criteria === 'string' || typeof criteria === 'number') {
		return { id: criteria };
	}

	return (criteria ?? {}) as Record<string, unknown>;
}

function serviceUnderTest(rows: IUsageRow[]) {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> | Array<Record<string, unknown>> }) =>
			rows.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			rows.filter((row) => matches(row, options?.where))[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) => rows.filter((row) => matches(row, where))[0] ?? null,
		count: async (options?: { where?: Record<string, unknown> }) =>
			rows.filter((row) => matches(row, options?.where)).length,
		create: (partial: IUsageRow) => ({ id: `usage-${rows.length + 1}`, ...partial }),
		save: async (entity: IUsageRow) => {
			rows.push(entity);

			return entity;
		},
		// Scoped criteria: `TenantScopedCrudService` merges the caller's tenant into every write, so
		// what reaches the repository is `{ id, tenantId }` and not the identifier alone.
		update: async (criteria: string | Record<string, unknown>, partial: Partial<IUsageRow>) => {
			const row = rows.find((one) => matches(one, criteriaOf(criteria)));

			if (row) {
				Object.assign(row, partial);
			}

			return { affected: 1 };
		}
	};

	return { rows, service: new PromotionUsageService(repository as never, {} as never) };
}

describe('PromotionUsageService — the redemption lifecycle (doc 08 §14.1–§14.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('registers an order without counting the redemption twice', async () => {
		// The reservation already counted against every limit and against the budget; registration only
		// moves the row, so a replayed checkout finds it registered and writes nothing new.
		const { service, rows } = serviceUnderTest([usage({ id: 'u-1', cartId: CART })]);

		const registered = await service.register(ORDER, CART);
		const replayed = await service.register(ORDER, CART);

		expect(registered).toHaveLength(1);
		expect(registered[0].status).toBe(PromotionUsageStatus.REGISTERED);
		expect(registered[0].orderId).toBe(ORDER);
		expect(replayed).toHaveLength(1);
		expect(rows).toHaveLength(1);
	});

	it('counts a customer\u2019s live redemptions and ignores the reverted ones', async () => {
		const { service } = serviceUnderTest([
			usage({ id: 'u-1', customerId: CUSTOMER, status: PromotionUsageStatus.RESERVED }),
			usage({ id: 'u-2', customerId: CUSTOMER, status: PromotionUsageStatus.REGISTERED }),
			usage({ id: 'u-3', customerId: CUSTOMER, status: PromotionUsageStatus.REVERTED }),
			usage({ id: 'u-4', customerId: 'someone-else', status: PromotionUsageStatus.REGISTERED })
		]);

		expect(await service.countByCustomer(PROMOTION, CUSTOMER)).toBe(2);
		expect(await service.countRegistered(PROMOTION)).toBe(2);
	});

	it('reverts the whole redemption under ALWAYS and writes nothing on a second reversal', async () => {
		// A compensated saga must not be able to revert twice, and the row is never deleted.
		const { service, rows } = serviceUnderTest([
			usage({ id: 'u-1', orderId: ORDER, status: PromotionUsageStatus.REGISTERED })
		]);

		const first = await service.revert(PROMOTION, ORDER, RevertOnReturnPolicy.ALWAYS);
		const second = await service.revert(PROMOTION, ORDER, RevertOnReturnPolicy.ALWAYS);

		expect(first.reverted).toBe('25');
		expect(first.usage?.status).toBe(PromotionUsageStatus.REVERTED);
		expect(second.reverted).toBe('0');
		expect(rows).toHaveLength(1);
	});

	it('keeps the benefit under NEVER', async () => {
		const { service } = serviceUnderTest([
			usage({ id: 'u-1', orderId: ORDER, status: PromotionUsageStatus.REGISTERED })
		]);

		const result = await service.revert(PROMOTION, ORDER, RevertOnReturnPolicy.NEVER);

		expect(result.reverted).toBe('0');
		expect(result.usage?.status).toBe(PromotionUsageStatus.REGISTERED);
		expect(Money.of(result.usage?.amount ?? '0', 'USD').toStorageString()).toBe('25.000000');
	});

	it('reverts a near-total share without the residual leaving the decimal domain', async () => {
		// `registered.allocate([share, 1 - share])` computed the residual in binary: for a returned
		// share of 0.9999999 that is `9.999999994736442e-8`, exponential notation, which is not a
		// decimal string at all — `Money.allocate` refused it and a `PROPORTIONAL` revert threw
		// `MONEY_NOT_DECIMAL_STRING` out of the return path as a 500 rather than reversing anything.
		const { service } = serviceUnderTest([
			usage({ id: 'u-1', orderId: ORDER, status: PromotionUsageStatus.REGISTERED, amount: '25.000000' })
		]);

		// The control is the *property*, not the digits: a literal pins one engine's rendering of the
		// same double and says nothing about why the old code failed. What matters is that the binary
		// residual does not render as a decimal at all, which is precisely what the money layer refuses.
		expect(String(1 - 0.9999999)).toMatch(/e-/);
		expect(1 - 0.9999999).not.toBe(1e-7);

		const result = await service.revert(PROMOTION, ORDER, RevertOnReturnPolicy.PROPORTIONAL, 0.9999999);

		expect(Money.of(result.reverted, 'USD').toStorageString()).toBe('25.000000');
		expect(result.usage?.status).toBe(PromotionUsageStatus.REVERTED);
	});

	it('splits a proportional reversal so the two parts sum back to what was registered', async () => {
		// The quieter half of the same defect: `1 - 0.07` is 0.9299999999999999 rather than 0.93, so
		// the weights are skewed and the largest-remainder tiebreak can hand the odd minor unit to the
		// wrong side. Seven percent of 10.01 divides into no whole number of pence, which is exactly
		// the case an allocation exists for: the reverted part and the residual the customer keeps must
		// still add up to 10.01 to the last penny.
		const { service, rows } = serviceUnderTest([
			usage({ id: 'u-1', orderId: ORDER, status: PromotionUsageStatus.REGISTERED, amount: '10.010000' })
		]);

		expect(1 - 0.07).toBe(0.9299999999999999);

		const result = await service.revert(PROMOTION, ORDER, RevertOnReturnPolicy.PROPORTIONAL, 0.07);
		const reverted = Money.of(result.reverted, 'USD');
		const residual = Money.of(rows[0].amount, 'USD');

		expect(reverted.add(residual).toStorageString()).toBe('10.010000');
		expect(reverted.toStorageString()).toBe('0.700000');
		// A partial reversal keeps the row registered: the customer kept part of the benefit.
		expect(rows[0].status).toBe(PromotionUsageStatus.REGISTERED);
	});

	it('reverts nothing for a share that is not a number at all', async () => {
		// A share computed upstream as a float and rendered exponentially, a NaN, an infinity: a
		// reversal is a compensating action and failing one leaves the order's money in a state nobody
		// asked for, so the nearest legal share is used instead of an exception.
		const { service } = serviceUnderTest([
			usage({ id: 'u-1', orderId: ORDER, status: PromotionUsageStatus.REGISTERED, amount: '10.000000' })
		]);

		const result = await service.revert(PROMOTION, ORDER, RevertOnReturnPolicy.PROPORTIONAL, Number.NaN);

		expect(Money.of(result.reverted, 'USD').toStorageString()).toBe('0.000000');
		expect(result.usage?.status).toBe(PromotionUsageStatus.REGISTERED);
	});

	it('never reverts more than was registered', async () => {
		const { service } = serviceUnderTest([
			usage({ id: 'u-1', orderId: ORDER, status: PromotionUsageStatus.REGISTERED, amount: '10.000000' })
		]);

		const result = await service.revert(PROMOTION, ORDER, RevertOnReturnPolicy.PROPORTIONAL, 5);

		expect(Number(result.reverted)).toBeLessThanOrEqual(10);
	});

	it('releases the reservations of an abandoned cart', async () => {
		const { service, rows } = serviceUnderTest([
			usage({ id: 'u-1', cartId: CART }),
			usage({ id: 'u-2', cartId: 'another-cart' }),
			usage({ id: 'u-3', cartId: CART, status: PromotionUsageStatus.REGISTERED })
		]);

		const released = await service.releaseCart(CART);

		expect(released).toHaveLength(1);
		expect(rows.map((row) => row.status)).toEqual([
			PromotionUsageStatus.REVERTED,
			PromotionUsageStatus.RESERVED,
			PromotionUsageStatus.REGISTERED
		]);
	});

	it('refuses to revert a redemption the promotion does not have on that order', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.revert(PROMOTION, ORDER)).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * The cases each defect was found by. Every one asserts what the lifecycle requires, and every one
 * passes now that the source does it.
 */
describe('PromotionUsageService — the behaviour each defect was found by', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reserves a promotion on a cart that has never reserved it', async () => {
		// The first reservation of any cart is the normal case. `reserve` asks for the live reservation
		// with a read that answers with null when the cart holds none (promotion-usage.service.ts:294-305,
		// reached from :66), so the "create the first one" path runs as well as the "reuse it" path.
		const { service, rows } = serviceUnderTest([]);

		const reservation = await service.reserve({
			promotionId: PROMOTION,
			cartId: CART,
			customerId: CUSTOMER,
			amount: '25.000000',
			currency: 'USD'
		});

		expect(reservation.status).toBe(PromotionUsageStatus.RESERVED);
		expect(rows).toHaveLength(1);
	});

	it('reverts a proportional share as an exact decimal', async () => {
		// F-22: the reverted amount is `allocate(appliedDiscount, [1, 2])[0]` — an allocation of an
		// already-rounded whole, so a third of 25.00 is 8.33 and the remaining 16.67 adds back to 25.00.
		// `revert` allocates rather than multiplies, so the two parts sum to the whole exactly.
		const { service, rows } = serviceUnderTest([
			usage({ id: 'u-1', orderId: ORDER, status: PromotionUsageStatus.REGISTERED, amount: '25.000000' })
		]);

		const result = await service.revert(PROMOTION, ORDER, RevertOnReturnPolicy.PROPORTIONAL, 1 / 3);

		expect(Money.of(result.reverted, 'USD').toStorageString()).toBe('8.330000');
		expect(Money.of(rows[0].amount, 'USD').add(Money.of(result.reverted, 'USD')).toStorageString()).toBe(
			'25.000000'
		);
	});
});
