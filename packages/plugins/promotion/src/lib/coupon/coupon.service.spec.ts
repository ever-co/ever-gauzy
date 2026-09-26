import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { COUPON_ALPHABET, CouponService } from './coupon.service';
import { PromotionUsageStatus } from '../promotion.types';

/**
 * Coupons: the code a customer types and the single use it entitles them to.
 *
 * Three rules carry the whole service, and each is asserted against its failure mode:
 *
 * - a code is normalised before the uniqueness check, so `save10` and `SAVE10` cannot both exist;
 * - taking a use is one conditional statement, so a code with one use left cannot be sold twice
 *   (asserted by consuming twice and counting);
 * - the per-customer limit is a fact about the usage ledger, so a *reverted* redemption does not
 *   count and one customer exhausting a code does not exhaust it for another.
 *
 * Code generation is asserted against the shape doc 08 §13.1 fixes — the alphabet with the ambiguous
 * glyphs removed — because a code that can be misread into another valid code is a discount anyone
 * can take.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const PROMOTION = '00000000-0000-4000-8000-000000000070';
const CUSTOMER_A = '00000000-0000-4000-8000-000000000060';
const CUSTOMER_B = '00000000-0000-4000-8000-000000000061';

const AT = new Date('2026-01-15T12:00:00.000Z');
const LAST_YEAR = new Date('2025-06-01T00:00:00.000Z');
const NEXT_YEAR = new Date('2027-06-01T00:00:00.000Z');

interface ICouponRow {
	id: string;
	tenantId: string;
	organizationId: string;
	code: string;
	promotionId?: string;
	batchId?: string;
	usageLimit?: number;
	usageCount: number;
	perCustomerLimit?: number;
	startsAt?: Date;
	endsAt?: Date;
	isActive?: boolean;
}

interface IUsageRow {
	id: string;
	couponId: string;
	customerId?: string;
	status: PromotionUsageStatus;
}

const coupon = (overrides: Partial<ICouponRow> & { id: string; code: string }): ICouponRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	promotionId: PROMOTION,
	usageCount: 0,
	isActive: true,
	...overrides
});

function matches(row: object, where: Record<string, unknown> | undefined): boolean {
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
 * @param coupons The `coupon` rows.
 * @param usages The `promotion_usage` rows the per-customer limit is answered from.
 * @param now The instant the in-memory conditional statement evaluates its window at; the statement
 * itself uses the database's clock, which the double stands in for.
 * @returns The service, the rows it wrote and the events it published.
 */
function serviceUnderTest(coupons: ICouponRow[], usages: IUsageRow[] = [], now: Date = AT) {
	const published: unknown[] = [];

	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			coupons.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			coupons.filter((row) => matches(row, options?.where))[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) => coupons.filter((row) => matches(row, where))[0] ?? null,
		create: (partial: ICouponRow) => ({ ...partial }),
		save: async (entity: ICouponRow | ICouponRow[]) => {
			for (const row of Array.isArray(entity) ? entity : [entity]) {
				coupons.push(row);
			}

			return entity;
		},
		manager: {
			getRepository: () => ({
				count: async (options?: { where?: Record<string, unknown> }) =>
					usages.filter((row) => matches(row, options?.where)).length
			})
		},
		// The conditional statement of doc 08 §13.2, modelled: it consumes a use only when the code is
		// active, inside its window and below its limit, and reports one affected row when it did.
		query: async (_sql: string, parameters: unknown[]) => {
			const row = coupons.find((one) => same(one.id, parameters[0]));

			if (!row || row.isActive === false) {
				return [[], 0];
			}
			if (row.usageLimit !== null && row.usageLimit !== undefined && row.usageCount >= row.usageLimit) {
				return [[], 0];
			}
			if (row.startsAt && new Date(row.startsAt) > now) {
				return [[], 0];
			}
			if (row.endsAt && new Date(row.endsAt) <= now) {
				return [[], 0];
			}

			row.usageCount += 1;

			return [[], 1];
		}
	};

	return {
		coupons,
		published,
		service: new CouponService(repository as never, {} as never, {
			publish: async (event: unknown) => published.push(event)
		} as never)
	};
}

describe('CouponService.validate — whether a code may be used, and why not (doc 08 §13.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('accepts a code inside its window and below every limit', async () => {
		const { service } = serviceUnderTest([coupon({ id: 'c-1', code: 'SAVE10' })]);

		const verdict = await service.validate('save10', { at: AT });

		expect(verdict.valid).toBe(true);
		expect(verdict.coupon?.code).toBe('SAVE10');
	});

	it('reads a coupon window as half-open', async () => {
		// Usable from its start instant, not usable at its end instant.
		const opening = serviceUnderTest([coupon({ id: 'c-open', code: 'OPEN', startsAt: AT })]);
		const closing = serviceUnderTest([coupon({ id: 'c-close', code: 'CLOSE', endsAt: AT })]);

		expect((await opening.service.validate('OPEN', { at: AT })).valid).toBe(true);
		expect((await opening.service.validate('OPEN', { at: new Date(AT.getTime() - 1) })).valid).toBe(false);
		expect((await closing.service.validate('CLOSE', { at: new Date(AT.getTime() - 1) })).valid).toBe(true);
		expect((await closing.service.validate('CLOSE', { at: AT })).valid).toBe(false);
	});

	it('refuses a code already redeemed to its limit', async () => {
		const { service } = serviceUnderTest([coupon({ id: 'c-once', code: 'ONCE', usageLimit: 1, usageCount: 1 })]);

		const verdict = await service.validate('ONCE', { at: AT });

		expect(verdict.valid).toBe(false);
		expect(verdict.reason).toBe('COUPON_LIMIT_EXCEEDED');
	});

	it('refuses a code that is not attached to a promotion or is switched off', async () => {
		const unlinked = serviceUnderTest([coupon({ id: 'c-1', code: 'ORPHAN', promotionId: undefined })]);
		const off = serviceUnderTest([coupon({ id: 'c-2', code: 'OFF', isActive: false })]);

		expect((await unlinked.service.validate('ORPHAN', { at: AT })).reason).toBe('COUPON_NOT_LINKED');
		expect((await off.service.validate('OFF', { at: AT })).reason).toBe('COUPON_INACTIVE');
	});

	it('counts the per-customer limit from the ledger, and ignores a reverted redemption', async () => {
		// `A` has redeemed once and `B` cancelled: only `A` is at their limit, and a customer who
		// cancelled is not blocked by their own history.
		const rows = [coupon({ id: 'c-1', code: 'WELCOME', perCustomerLimit: 1 })];
		const usages: IUsageRow[] = [
			{ id: 'u-1', couponId: 'c-1', customerId: CUSTOMER_A, status: PromotionUsageStatus.REGISTERED },
			{ id: 'u-2', couponId: 'c-1', customerId: CUSTOMER_B, status: PromotionUsageStatus.REVERTED }
		];
		const { service } = serviceUnderTest(rows, usages);

		expect(await service.countCustomerRedemptions('c-1', CUSTOMER_A)).toBe(1);
		expect(await service.countCustomerRedemptions('c-1', CUSTOMER_B)).toBe(0);
		expect((await service.validate('WELCOME', { customerId: CUSTOMER_A, at: AT })).reason).toBe(
			'COUPON_CUSTOMER_LIMIT_EXCEEDED'
		);
		expect((await service.validate('WELCOME', { customerId: CUSTOMER_B, at: AT })).valid).toBe(true);
	});
});

describe('CouponService.createCoupon and createBatch (doc 08 §13.1)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('stores a code upper-cased, so one code cannot exist twice in two spellings', async () => {
		const { service } = serviceUnderTest([coupon({ id: 'c-1', code: 'SAVE10' })]);

		await expect(service.createCoupon({ code: 'save10' })).rejects.toMatchObject({
			message: expect.stringContaining('already exists')
		});
	});

	it('refuses a coupon with no code', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.createCoupon({ code: '  ' })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('generates a batch of codes in the documented shape, with the ambiguous glyphs removed', async () => {
		// Thirty characters: no `I`, `O`, `L` or `U`, so a code read aloud or copied from paper cannot be
		// mistyped into a different valid code. Three groups of four, and no two codes alike.
		const { service, coupons } = serviceUnderTest([]);

		const result = await service.createBatch({ code: 'BATCH', count: 25 });

		expect(result.requested).toBe(25);
		expect(result.created).toBe(25);
		expect(result.failed).toBe(0);

		const codes = coupons.map((row) => row.code);
		expect(codes).toHaveLength(25);
		expect(new Set(codes).size).toBe(25);

		for (const code of codes) {
			const significant = code.replace(/-/g, '');

			expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
			expect(significant).toHaveLength(12);
			expect([...significant].every((character) => COUPON_ALPHABET.includes(character))).toBe(true);
			expect(code).not.toMatch(/[IOLU]/);
		}
	});

	it('gives every coupon of a batch one batch identifier and the batch limits', async () => {
		const { service, coupons } = serviceUnderTest([]);

		const result = await service.createBatch({
			code: 'BATCH',
			count: 3,
			usageLimit: 1,
			perCustomerLimit: 1,
			endsAt: NEXT_YEAR
		});

		expect(coupons.map((row) => row.batchId)).toEqual([result.batchId, result.batchId, result.batchId]);
		expect(coupons.every((row) => row.usageCount === 0 && row.usageLimit === 1)).toBe(true);
	});

	it('refuses a batch size that is not a usable count', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.createBatch({ code: 'BATCH', count: 0 })).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.createBatch({ code: 'BATCH', count: 1.5 })).rejects.toBeInstanceOf(BadRequestException);
		await expect(service.createBatch({ code: 'BATCH', count: 100001 })).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('CouponService.redeem — one use, taken once (doc 08 §13.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('consumes the last use once and refuses the second attempt', async () => {
		// Two checkouts reaching the same code: exactly one takes the use, and the counter says so.
		const { service, coupons } = serviceUnderTest([coupon({ id: 'c-once', code: 'ONCE', usageLimit: 1 })]);

		const first = await service.redeem('c-once', '5.000000');
		const second = await service.redeem('c-once', '5.000000');

		expect([first, second]).toEqual([true, false]);
		expect(coupons[0].usageCount).toBe(1);
	});

	it('reports a redemption to subscribers only when the use was really taken', async () => {
		// A subscriber that reported a redemption the statement refused would show a discount nobody got.
		const { service, published } = serviceUnderTest([coupon({ id: 'c-once', code: 'ONCE', usageLimit: 1 })]);

		await service.redeem('c-once', '5.000000');
		await service.redeem('c-once', '5.000000');

		expect(published).toHaveLength(1);
	});

	it('refuses a use of a code that is switched off, ended or not yet started', async () => {
		const off = serviceUnderTest([coupon({ id: 'c-off', code: 'OFF', isActive: false })]);
		const ended = serviceUnderTest([coupon({ id: 'c-ended', code: 'ENDED', endsAt: LAST_YEAR })]);
		const future = serviceUnderTest([coupon({ id: 'c-future', code: 'SOON', startsAt: NEXT_YEAR })]);

		expect(await off.service.redeem('c-off')).toBe(false);
		expect(await ended.service.redeem('c-ended')).toBe(false);
		expect(await future.service.redeem('c-future')).toBe(false);
		expect(off.coupons[0].usageCount).toBe(0);
	});

	it('refuses to redeem a coupon that is not in the caller\u2019s scope', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.findCouponOrFail('c-missing')).rejects.toBeInstanceOf(NotFoundException);
	});
});

/**
 * The case the defect was found by. It asserts what the endpoint requires, and it passes now that
 * the source does it.
 */
describe('CouponService.validate — the behaviour the defect was found by', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('answers a code that names no coupon instead of failing the lookup', async () => {
		// `validate` is the endpoint a checkout calls with whatever the customer typed, and it is
		// written to answer with a reason (`if (!coupon) return { valid: false, reason: 'COUPON_INVALID' }`).
		// The read it uses answers with null when no row carries the code, so a mistyped code is
		// reported as an invalid code rather than as a missing resource
		// (doc 06 §6.6 `COUPON_INVALID`, doc 08 §13.2).
		const { service } = serviceUnderTest([coupon({ id: 'c-1', code: 'SAVE10' })]);

		const verdict = await service.validate('not-a-code', { at: AT });

		expect(verdict).toEqual({ valid: false, reason: 'COUPON_INVALID' });
	});
});
