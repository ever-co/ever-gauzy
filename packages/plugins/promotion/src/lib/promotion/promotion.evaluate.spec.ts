import { BadRequestException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { Money, RequestContext } from '@gauzy/core';
import { CampaignBudgetService } from '../campaign-budget/campaign-budget.service';
import { CampaignService } from '../campaign/campaign.service';
import { PromotionActionService } from '../promotion-action/promotion-action.service';
import { PromotionUsageService } from '../promotion-usage/promotion-usage.service';
import {
	CampaignBudgetType,
	CampaignStatus,
	PromotionActionAllocation,
	PromotionActionTargetType,
	PromotionActionType,
	PromotionNotice,
	PromotionStatus,
	PromotionType,
	PromotionUsageStatus
} from '../promotion.types';
import { PromotionService } from './promotion.service';

/**
 * The promotion engine: what applies, in what order, and how much comes off each owner.
 *
 * The suite pins the properties the domain fixes rather than one worked total:
 *
 * - every exclusion is reported, because a promotion that silently does nothing is the defect an
 *   operator cannot diagnose (doc 08 §11 step 2);
 * - a later promotion sees only what the earlier ones left, so no promotion can discount money
 *   another has already removed (§11.1) — asserted against the specification's own worked example;
 * - the split of a discount across owners is a largest-remainder allocation, so the parts sum to the
 *   whole exactly (P2.1);
 * - the same promotion reached twice in one evaluation applies once (§11 step 1);
 * - a campaign budget admits only its headroom, and a discount larger than the discountable amount
 *   is clamped rather than made negative (fixtures `discount.campaign-budget-partial` and
 *   `discount.fixed-order-level-clamped`).
 *
 * The service is constructed with in-memory doubles of its repositories and with the *real*
 * collaborator services it owns (actions, usage ledger, campaigns), so the ordering and the counting
 * under test are the ones that ship. No database, no network, no wall clock: the instant every case
 * runs at is stated in the context.
 *
 * The cases at the end are the ones a defect was found by: each asserts behaviour the specification
 * requires and names the source it comes from.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CHANNEL_WEB = '00000000-0000-4000-8000-000000000020';
const CHANNEL_SHOP = '00000000-0000-4000-8000-000000000021';
const GROUP_VIP = '00000000-0000-4000-8000-000000000041';
const CUSTOMER_A = '00000000-0000-4000-8000-000000000060';
const CUSTOMER_B = '00000000-0000-4000-8000-000000000061';

const AT = new Date('2026-01-15T12:00:00.000Z');
const LAST_YEAR = new Date('2025-06-01T00:00:00.000Z');
const NEXT_YEAR = new Date('2027-06-01T00:00:00.000Z');

interface IPromotionRow {
	id: string;
	tenantId: string;
	organizationId: string;
	code?: string;
	title: string;
	type: PromotionType;
	status: PromotionStatus;
	isAutomatic: boolean;
	isCombinable: boolean;
	stackingGroup?: string;
	priority: number;
	channelId?: string;
	currency?: string;
	customerGroupId?: string;
	campaignId?: string;
	startsAt?: Date;
	endsAt?: Date;
	usageLimit?: number;
	usageCount: number;
	perCustomerUsageLimit?: number;
	budgetAmount?: string;
	budgetSpent: string;
	isTaxInclusive: boolean;
}

interface IActionRow {
	id: string;
	tenantId: string;
	organizationId: string;
	promotionId: string;
	type: PromotionActionType;
	targetType: PromotionActionTargetType;
	allocation: PromotionActionAllocation;
	value: string;
	currency?: string;
	maxQuantity?: string;
	isTaxInclusive: boolean;
	position: number;
	metadata?: Record<string, unknown>;
}

interface ICampaignRow {
	id: string;
	tenantId: string;
	organizationId: string;
	identifier: string;
	name: string;
	status: CampaignStatus;
	startsAt?: Date;
	endsAt?: Date;
}

interface IBudgetRow {
	id: string;
	tenantId: string;
	organizationId: string;
	campaignId: string;
	type: CampaignBudgetType;
	limit: string;
	used: string;
	currency?: string;
}

interface IUsageRow {
	id: string;
	tenantId: string;
	organizationId: string;
	promotionId: string;
	couponId?: string;
	customerId?: string;
	cartId?: string;
	amount: string;
	currency: string;
	status: PromotionUsageStatus;
}

/** A promotion in the fixture state: active, automatic, unlimited, in any channel and currency. */
const promotion = (overrides: Partial<IPromotionRow> & { id: string; title: string }): IPromotionRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	type: PromotionType.STANDARD,
	status: PromotionStatus.ACTIVE,
	isAutomatic: true,
	isCombinable: true,
	priority: 0,
	usageCount: 0,
	budgetSpent: '0',
	isTaxInclusive: false,
	...overrides
});

/** An action of a promotion. */
const action = (overrides: Partial<IActionRow> & { id: string; promotionId: string; value: string }): IActionRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	type: PromotionActionType.PERCENTAGE,
	targetType: PromotionActionTargetType.ORDER,
	allocation: PromotionActionAllocation.ACROSS,
	isTaxInclusive: false,
	position: 0,
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

		// TypeORM reads an array as a set membership test: `status: [A, B]` is `status IN (A, B)`.
		if (Array.isArray(expected)) {
			return expected.some((one) => same(one, value));
		}

		return expected === undefined || same(expected, value);
	});
}

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

/** The fixture world: the tables an evaluation reads, and the writes it produced. */
function world(fixture: {
	promotions?: IPromotionRow[];
	actions?: IActionRow[];
	campaigns?: ICampaignRow[];
	budgets?: IBudgetRow[];
	usages?: IUsageRow[];
}) {
	const promotions = fixture.promotions ?? [];
	const actions = fixture.actions ?? [];
	const campaigns = fixture.campaigns ?? [];
	const budgets = fixture.budgets ?? [];
	const usages = fixture.usages ?? [];
	const published: unknown[] = [];

	const promotionRepository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			promotions.filter((row) => matches(row, options?.where)),
		findOneBy: async (where?: Record<string, unknown>) => promotions.filter((row) => matches(row, where))[0] ?? null,
		update: async (id: string, partial: Partial<IPromotionRow>) => {
			const row = promotions.find((one) => same(one.id, id));

			if (row) {
				Object.assign(row, partial);
			}

			return { affected: 1 };
		}
	};

	const actionRepository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			actions
				.filter((row) => matches(row, options?.where))
				.sort((left, right) => left.position - right.position)
	};

	const usageRepository = {
		count: async (options?: { where?: Record<string, unknown> }) =>
			usages.filter((row) => matches(row, options?.where)).length,
		find: async (options?: { where?: Record<string, unknown> }) =>
			usages.filter((row) => matches(row, options?.where))
	};

	const campaignRepository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			campaigns.filter((row) => matches(row, options?.where)),
		findOneBy: async (where?: Record<string, unknown>) => campaigns.filter((row) => matches(row, where))[0] ?? null
	};

	const budgetRepository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			budgets.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			budgets.filter((row) => matches(row, options?.where))[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) => budgets.filter((row) => matches(row, where))[0] ?? null
	};

	const budgetUsageRepository = {
		find: async () => [],
		findOne: async () => null
	};

	const service = new PromotionService(
		promotionRepository as never,
		{} as never,
		new PromotionActionService(actionRepository as never, {} as never),
		new PromotionUsageService(usageRepository as never, {} as never),
		new CampaignService(campaignRepository as never, {} as never),
		// The real budget service over a double of its repository, so the composition under test is the
		// one that ships: it is the base class's `findOneByWhereOptions` that throws when a campaign
		// carries no budget row.
		new CampaignBudgetService(budgetRepository as never, {} as never, budgetUsageRepository as never),
		{ publish: async (event: unknown) => published.push(event) } as never
	);

	return { service, published, promotions, usages };
}

/**
 * A cart context: the lines, the currency and the instant every case prices at.
 *
 * The default line is 20.00, so that a ten percent discount of it is 2.00 exactly and the arithmetic
 * of a case that is not about a fraction is read at a glance; the cases that are about a fraction
 * state the amount they need.
 */
const context = (overrides: Record<string, unknown> = {}) => ({
	currency: 'USD',
	codes: [] as string[],
	lines: [{ id: 'L1', amount: '20.000000', quantity: 2 }],
	shipping: [] as Array<{ id: string; amount: string }>,
	at: AT,
	...overrides
});

describe('PromotionService.evaluate — what matches, and what is reported when it does not (doc 08 §11)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('discounts the lines a promotion targets, and reports the amount it gave away', async () => {
		// Ten percent of a 20.00 line is 2.00, and it lands on the line it was computed from.
		const spring = promotion({ id: 'promo-spring', code: 'SPRING10', title: 'Spring 10 %' });
		const { service } = world({
			promotions: [spring],
			actions: [
				action({
					id: 'act-spring',
					promotionId: spring.id,
					type: PromotionActionType.PERCENTAGE,
					targetType: PromotionActionTargetType.ITEMS,
					allocation: PromotionActionAllocation.ONCE,
					value: '10'
				})
			]
		});

		const evaluation = await service.evaluate(context());

		expect(evaluation.result.applications).toHaveLength(1);
		expect(evaluation.result.applications[0]).toMatchObject({
			promotionId: spring.id,
			code: 'SPRING10',
			isAutomatic: true,
			currency: 'USD'
		});
		expect(Money.of(evaluation.result.applications[0].amount, 'USD').toStorageString()).toBe('2.000000');
		expect(evaluation.allocations).toHaveLength(1);
		expect(evaluation.allocations[0]).toMatchObject({ ownerType: 'LINE', ownerId: 'L1' });
		expect(Money.of(evaluation.allocations[0].amount, 'USD').toStorageString()).toBe('-2.000000');
		expect(evaluation.result.notices).toEqual([]);
	});

	it('does not apply a promotion whose currency, channel or customer group the context does not match', async () => {
		// Each of the three scope columns narrows the promotion, and the same promotion applies when
		// the context does match — so the case cannot pass by the promotion being ineligible anyway.
		const scoped = (id: string, extra: Partial<IPromotionRow>) =>
			world({
				promotions: [promotion({ id, code: id, title: id, ...extra })],
				actions: [action({ id: `act-${id}`, promotionId: id, value: '10' })]
			}).service;

		const usdOnly = scoped('promo-usd', { currency: 'USD' });
		const webOnly = scoped('promo-web', { channelId: CHANNEL_WEB });
		const vipOnly = scoped('promo-vip', { customerGroupId: GROUP_VIP });

		expect((await usdOnly.evaluate(context({ currency: 'CAD' }))).result.applications).toEqual([]);
		expect((await webOnly.evaluate(context({ channelId: CHANNEL_SHOP }))).result.applications).toEqual([]);
		expect((await vipOnly.evaluate(context())).result.applications).toEqual([]);

		expect((await usdOnly.evaluate(context({ currency: 'USD' }))).result.applications).toHaveLength(1);
		expect((await webOnly.evaluate(context({ channelId: CHANNEL_WEB }))).result.applications).toHaveLength(1);
		expect((await vipOnly.evaluate(context({ customerGroupIds: [GROUP_VIP] }))).result.applications).toHaveLength(1);
	});

	it('treats a promotion window as half-open', async () => {
		// Open at its start instant, closed at its end instant: two adjacent windows never both claim
		// the same moment.
		const opening = promotion({ id: 'promo-opening', code: 'OPENING', title: 'Opening', startsAt: AT });
		const closing = promotion({ id: 'promo-closing', code: 'CLOSING', title: 'Closing', endsAt: AT });
		const { service } = world({
			promotions: [opening, closing],
			actions: [
				action({ id: 'act-opening', promotionId: opening.id, value: '10' }),
				action({ id: 'act-closing', promotionId: closing.id, value: '10' })
			]
		});

		const codes = ['OPENING', 'CLOSING'];
		const atStart = await service.evaluate(context({ codes }));
		const justBefore = await service.evaluate(context({ codes, at: new Date(AT.getTime() - 1) }));

		expect(atStart.result.applications.map((application) => application.code)).toEqual(['OPENING']);
		expect(justBefore.result.applications.map((application) => application.code)).toEqual(['CLOSING']);
	});

	it('does not apply a promotion whose campaign is not running', async () => {
		// A campaign is a window a promotion is admitted inside; a draft campaign admits nothing.
		const campaign = {
			id: 'campaign-1',
			tenantId: TENANT,
			organizationId: ORG,
			identifier: 'SUMMER',
			name: 'Summer',
			status: CampaignStatus.DRAFT
		};
		const inside = promotion({ id: 'promo-1', code: 'SUMMER10', title: 'Summer 10 %', campaignId: campaign.id });
		const { service } = world({
			promotions: [inside],
			actions: [action({ id: 'act-1', promotionId: inside.id, value: '10' })],
			campaigns: [campaign]
		});

		const evaluation = await service.evaluate(context());

		expect(evaluation.result.applications).toEqual([]);
		expect(evaluation.result.notices.map((notice) => notice.notice)).toEqual([
			PromotionNotice.CAMPAIGN_WINDOW_CLOSED
		]);
	});

	it('does not apply a promotion that has reached its usage limit, and applies it while under it', async () => {
		const limited = promotion({
			id: 'promo-limited',
			code: 'ONCE',
			title: 'Once only',
			usageLimit: 2,
			usageCount: 1
		});
		const exhausted = promotion({
			id: 'promo-exhausted',
			code: 'SPENT',
			title: 'Spent',
			usageLimit: 2,
			usageCount: 2
		});
		const { service } = world({
			promotions: [limited, exhausted],
			actions: [
				action({ id: 'act-limited', promotionId: limited.id, value: '10' }),
				action({ id: 'act-exhausted', promotionId: exhausted.id, value: '10' })
			]
		});

		const evaluation = await service.evaluate(context());

		expect(evaluation.result.applications.map((application) => application.code)).toEqual(['ONCE']);
		expect(evaluation.result.notices.map((notice) => notice.notice)).toContain(
			PromotionNotice.USAGE_LIMIT_EXCEEDED
		);
	});

	it('counts a redemption per customer, so one customer exhausting a code leaves it available to another', async () => {
		// The per-customer limit is a fact about the usage ledger, and a reverted redemption is not a
		// redemption: a customer who cancelled is not blocked by their own history.
		const limited = promotion({
			id: 'promo-customer',
			code: 'WELCOME',
			title: 'Welcome',
			perCustomerUsageLimit: 1
		});
		const usage = (customerId: string, status: PromotionUsageStatus): IUsageRow => ({
			id: `usage-${customerId}-${status}`,
			tenantId: TENANT,
			organizationId: ORG,
			promotionId: limited.id,
			customerId,
			amount: '5.000000',
			currency: 'USD',
			status
		});
		const { service } = world({
			promotions: [limited],
			actions: [action({ id: 'act-customer', promotionId: limited.id, value: '10' })],
			usages: [usage(CUSTOMER_A, PromotionUsageStatus.REGISTERED), usage(CUSTOMER_B, PromotionUsageStatus.REVERTED)]
		});

		const forA = await service.evaluate(context({ customerId: CUSTOMER_A }));
		const forB = await service.evaluate(context({ customerId: CUSTOMER_B }));

		expect(forA.result.applications).toEqual([]);
		expect(forA.result.notices.map((notice) => notice.notice)).toEqual([
			PromotionNotice.PER_CUSTOMER_LIMIT_EXCEEDED
		]);
		expect(forB.result.applications).toHaveLength(1);
	});

	it('applies each promotion once however many ways the caller presents it', async () => {
		// A code written twice, or a promotion that is both coded and automatic, is one candidate:
		// the customer gets the discount once, not twice.
		const spring = promotion({ id: 'promo-spring', code: 'SPRING10', title: 'Spring 10 %' });
		const { service } = world({
			promotions: [spring],
			actions: [
				action({
					id: 'act-spring',
					promotionId: spring.id,
					type: PromotionActionType.PERCENTAGE,
					targetType: PromotionActionTargetType.ITEMS,
					allocation: PromotionActionAllocation.ONCE,
					value: '10'
				})
			]
		});

		const throughTwoCodes = await service.evaluate(context({ codes: ['SPRING10', 'spring10'] }));
		const throughCodeAndAutomatic = await service.evaluate(context({ codes: ['SPRING10'] }));

		expect(throughTwoCodes.result.applications).toHaveLength(1);
		expect(throughTwoCodes.allocations).toHaveLength(1);
		expect(Money.of(throughTwoCodes.result.applications[0].amount, 'USD').toStorageString()).toBe('2.000000');
		expect(throughCodeAndAutomatic.result.applications).toHaveLength(1);
	});

	it('clamps a fixed discount to the amount there is to discount', async () => {
		// Fixture `discount.fixed-order-level-clamped`: a discount larger than the cart is the cart,
		// never a negative line and never a credit.
		const generous = promotion({ id: 'promo-big', code: 'BIG', title: '999 off' });
		const { service } = world({
			promotions: [generous],
			actions: [
				action({
					id: 'act-big',
					promotionId: generous.id,
					type: PromotionActionType.FIXED,
					value: '999.000000',
					currency: 'USD'
				})
			]
		});

		const evaluation = await service.evaluate(context({ lines: [{ id: 'L1', amount: '20.000000', quantity: 1 }] }));

		expect(Money.of(evaluation.result.applications[0].amount, 'USD').toStorageString()).toBe('20.000000');
		expect(Money.of(evaluation.allocations[0].amount, 'USD').toStorageString()).toBe('-20.000000');
	});

	it('lands a shipping discount on the shipping method and never on a line', async () => {
		// Fixture `discount.free-shipping`: the line keeps its money and the shipping reaches zero.
		const freeship = promotion({ id: 'promo-ship', code: 'FREESHIP', title: 'Free shipping', type: PromotionType.FREE_SHIPPING });
		const { service } = world({
			promotions: [freeship],
			actions: [
				action({
					id: 'act-ship',
					promotionId: freeship.id,
					type: PromotionActionType.FREE_SHIPPING,
					targetType: PromotionActionTargetType.SHIPPING,
					value: '999.000000',
					currency: 'USD'
				})
			]
		});

		const evaluation = await service.evaluate(
			context({ lines: [{ id: 'L1', amount: '20.000000', quantity: 1 }], shipping: [{ id: 'SM1', amount: '14.950000' }] })
		);

		expect(evaluation.allocations).toHaveLength(1);
		expect(evaluation.allocations[0]).toMatchObject({ ownerType: 'SHIPPING', ownerId: 'SM1' });
		expect(Money.of(evaluation.allocations[0].amount, 'USD').toStorageString()).toBe('-14.950000');
		expect(evaluation.allocations.some((allocation) => allocation.ownerType === 'LINE')).toBe(false);
	});

	it('reports that a promotion had nothing to discount rather than applying it silently', async () => {
		const freeship = promotion({ id: 'promo-ship', code: 'FREESHIP', title: 'Free shipping', type: PromotionType.FREE_SHIPPING });
		const { service } = world({
			promotions: [freeship],
			actions: [
				action({
					id: 'act-ship',
					promotionId: freeship.id,
					type: PromotionActionType.FREE_SHIPPING,
					targetType: PromotionActionTargetType.SHIPPING,
					value: '999.000000',
					currency: 'USD'
				})
			]
		});

		// No shipping method in the context, so the promotion has no owner to discount.
		const evaluation = await service.evaluate(context());

		expect(evaluation.result.applications).toEqual([]);
		expect(evaluation.allocations).toEqual([]);
		expect(evaluation.result.notices.map((notice) => notice.notice)).toEqual([
			PromotionNotice.NO_DISCOUNTABLE_AMOUNT
		]);
	});

	it('splits a discount by largest remainder, and each promotion sees only what the last one left', async () => {
		// Doc 08 §11.1's worked example, run through the engine: L1 100.00 and L2 50.00, `A` 20 % off
		// the order at priority 10 and `B` 20.00 off the order at priority 20.
		//
		// `A` takes 30.00 as 20.00 / 10.00. `B` then sees 80.00 / 40.00 — not the original 150.00 — and
		// its 20.00 divides as 13.333… / 6.666…, which the largest-remainder rule settles at
		// 13.33 / 6.67 so that the two parts sum to the whole exactly.
		const percent = promotion({ id: 'promo-a', code: 'A', title: '20 % off', priority: 10, isAutomatic: false });
		const fixed = promotion({ id: 'promo-b', code: 'B', title: '20 off', priority: 20, isAutomatic: false });
		const { service } = world({
			promotions: [percent, fixed],
			actions: [
				action({
					id: 'act-a',
					promotionId: percent.id,
					type: PromotionActionType.PERCENTAGE,
					targetType: PromotionActionTargetType.ORDER,
					value: '20'
				}),
				action({
					id: 'act-b',
					promotionId: fixed.id,
					type: PromotionActionType.FIXED,
					targetType: PromotionActionTargetType.ORDER,
					value: '20.000000',
					currency: 'USD'
				})
			]
		});

		const evaluation = await service.evaluate(
			context({
				codes: ['A', 'B'],
				lines: [
					{ id: 'L1', amount: '100.000000', quantity: 1 },
					{ id: 'L2', amount: '50.000000', quantity: 1 }
				]
			})
		);
		const storage = evaluation.allocations.map((allocation) => Money.of(allocation.amount, 'USD').toStorageString());

		expect(evaluation.result.applications.map((application) => application.code)).toEqual(['A', 'B']);
		expect(storage).toEqual(['-20.000000', '-10.000000', '-13.330000', '-6.670000']);

		// The parts of each promotion sum to what that promotion said it gave away.
		const givenAway = Money.of(evaluation.result.applications[0].amount, 'USD')
			.add(Money.of(evaluation.result.applications[1].amount, 'USD'))
			.toStorageString();
		const parts = Money.sum(
			evaluation.allocations.map((allocation) => Money.of(allocation.amount, 'USD')),
			'USD'
		);
		expect(givenAway).toBe('50.000000');
		expect(parts.abs().toStorageString()).toBe('50.000000');
	});

	it('applies only the headroom of a campaign budget, and reports that it did (fixture discount.campaign-budget-partial)', async () => {
		// A budget with 20.00 left against a 50.00 discount yields a 20.00 application and the
		// PARTIALLY_APPLIED_BUDGET notice; the campaign is never oversold.
		const campaign = {
			id: 'campaign-budget',
			tenantId: TENANT,
			organizationId: ORG,
			identifier: 'BUDGETED',
			name: 'Budgeted',
			status: CampaignStatus.ACTIVE
		};
		const inside = promotion({ id: 'promo-budget', code: 'BUDGET', title: 'Budgeted', campaignId: campaign.id });
		const { service } = world({
			promotions: [inside],
			actions: [
				action({
					id: 'act-budget',
					promotionId: inside.id,
					type: PromotionActionType.FIXED,
					value: '50.000000',
					currency: 'USD'
				})
			],
			campaigns: [campaign],
			budgets: [
				{
					id: 'budget-1',
					tenantId: TENANT,
					organizationId: ORG,
					campaignId: campaign.id,
					type: CampaignBudgetType.SPEND,
					limit: '100.000000',
					used: '80.000000',
					currency: 'USD'
				}
			]
		});

		const evaluation = await service.evaluate(context({ lines: [{ id: 'L1', amount: '60.000000', quantity: 1 }] }));

		expect(Money.of(evaluation.result.applications[0].amount, 'USD').toStorageString()).toBe('20.000000');
		expect(evaluation.result.notices.map((notice) => notice.notice)).toEqual([
			PromotionNotice.PARTIALLY_APPLIED_BUDGET
		]);
	});

	it('does not apply a promotion whose budget is spent', async () => {
		const spent = promotion({
			id: 'promo-spent',
			code: 'SPENT',
			title: 'Spent',
			budgetAmount: '100.000000',
			budgetSpent: '100.000000'
		});
		const { service } = world({
			promotions: [spent],
			actions: [action({ id: 'act-spent', promotionId: spent.id, value: '10' })]
		});

		const evaluation = await service.evaluate(context());

		expect(evaluation.result.applications).toEqual([]);
		expect(evaluation.result.notices.map((notice) => notice.notice)).toEqual([PromotionNotice.BUDGET_EXCEEDED]);
	});

	it('reports its result as the exact decimals the money layer can carry', async () => {
		// P2.1/I12: the parts sum to the whole to the last minor unit, and every amount is a decimal a
		// money column accepts — never a binary floating-point artefact.
		const third = promotion({ id: 'promo-third', code: 'THIRD', title: 'A third off' });
		const { service } = world({
			promotions: [third],
			actions: [
				action({
					id: 'act-third',
					promotionId: third.id,
					type: PromotionActionType.FIXED,
					targetType: PromotionActionTargetType.ORDER,
					value: '33.330000',
					currency: 'USD'
				})
			]
		});

		const evaluation = await service.evaluate(
			context({
				lines: [
					{ id: 'L1', amount: '19.990000', quantity: 1 },
					{ id: 'L2', amount: '29.990000', quantity: 1 },
					{ id: 'L3', amount: '49.990000', quantity: 1 }
				]
			})
		);
		const parts = Money.sum(
			evaluation.allocations.map((allocation) => Money.of(allocation.amount, 'USD')),
			'USD'
		);

		expect(Money.of(evaluation.result.applications[0].amount, 'USD').abs().toStorageString()).toBe(
			parts.abs().toStorageString()
		);
		expect(parts.abs().toStorageString()).toBe('33.330000');
	});

	it('simulates one promotion without touching the promotion or the ledger', async () => {
		// P19/P20: the dry run answers with the same numbers the live evaluation would and writes
		// nothing — no usage row, no counter, no budget movement.
		const spring = promotion({ id: 'promo-spring', code: 'SPRING10', title: 'Spring 10 %' });
		const other = promotion({ id: 'promo-other', code: 'OTHER', title: 'Other 50 %' });
		const { service, promotions, usages } = world({
			promotions: [spring, other],
			actions: [
				action({
					id: 'act-spring',
					promotionId: spring.id,
					type: PromotionActionType.PERCENTAGE,
					targetType: PromotionActionTargetType.ITEMS,
					allocation: PromotionActionAllocation.ONCE,
					value: '10'
				}),
				action({
					id: 'act-other',
					promotionId: other.id,
					type: PromotionActionType.PERCENTAGE,
					targetType: PromotionActionTargetType.ITEMS,
					allocation: PromotionActionAllocation.ONCE,
					value: '50'
				})
			]
		});

		const simulated = await service.simulate(spring.id, context());

		expect(simulated.result.applications.map((application) => application.promotionId)).toEqual([spring.id]);
		expect(Money.of(simulated.result.applications[0].amount, 'USD').toStorageString()).toBe('2.000000');
		expect(promotions.map((row) => row.usageCount)).toEqual([0, 0]);
		expect(usages).toEqual([]);
	});
});

describe('PromotionService — publishing and withdrawing (doc 08 §8.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses to activate a promotion that has no action', async () => {
		// An active promotion with no effect is a candidate that can never apply.
		const { service } = world({ promotions: [promotion({ id: 'promo-empty', title: 'Empty', status: PromotionStatus.DRAFT })] });

		await expect(service.activate('promo-empty')).rejects.toBeInstanceOf(BadRequestException);
	});

	it('activates a promotion and announces the change', async () => {
		// A cache that holds a promotion set has to be told, or it serves a promotion that has just
		// been switched off.
		const spring = promotion({ id: 'promo-spring', code: 'SPRING10', title: 'Spring', status: PromotionStatus.DRAFT });
		const { service, published } = world({
			promotions: [spring],
			actions: [action({ id: 'act-spring', promotionId: spring.id, value: '10' })]
		});

		const activated = await service.activate(spring.id);

		expect(activated.status).toBe(PromotionStatus.ACTIVE);
		expect(published).toHaveLength(1);
	});
});

/**
 * The cases each defect was found by. Every one asserts what the specification requires, and every
 * one passes now that the source does it: the case is named here rather than deleted so the
 * behaviour it pinned stays pinned.
 */
describe('PromotionService.evaluate — the behaviour each defect was found by', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('evaluates a promotion attached to a campaign that has no budget', async () => {
		// A campaign is a window; a budget is optional. `budgetHeadroom` asks the budget service for the
		// campaign's budget with a read that answers with null when the campaign has no ceiling, so an
		// unbudgeted promotion applies instead of failing the whole evaluation.
		const campaign = {
			id: 'campaign-plain',
			tenantId: TENANT,
			organizationId: ORG,
			identifier: 'PLAIN',
			name: 'Plain',
			status: CampaignStatus.ACTIVE
		};
		const inside = promotion({ id: 'promo-plain', code: 'PLAIN10', title: 'Plain', campaignId: campaign.id });
		const { service } = world({
			promotions: [inside],
			actions: [action({ id: 'act-plain', promotionId: inside.id, value: '10' })],
			campaigns: [campaign]
		});

		const evaluation = await service.evaluate(context());

		expect(evaluation.result.applications).toHaveLength(1);
	});

	it('allocates no more than the budget headroom it applied', async () => {
		// The application is truncated to the headroom and the adjustment rows are written from the
		// truncated amount, so Σ|allocations| is what was granted and the caller's discount is never
		// larger than the campaign's remaining money.
		const campaign = {
			id: 'campaign-budget',
			tenantId: TENANT,
			organizationId: ORG,
			identifier: 'BUDGETED',
			name: 'Budgeted',
			status: CampaignStatus.ACTIVE
		};
		const inside = promotion({ id: 'promo-budget', code: 'BUDGET', title: 'Budgeted', campaignId: campaign.id });
		const { service } = world({
			promotions: [inside],
			actions: [
				action({
					id: 'act-budget',
					promotionId: inside.id,
					type: PromotionActionType.FIXED,
					value: '50.000000',
					currency: 'USD'
				})
			],
			campaigns: [campaign],
			budgets: [
				{
					id: 'budget-1',
					tenantId: TENANT,
					organizationId: ORG,
					campaignId: campaign.id,
					type: CampaignBudgetType.SPEND,
					limit: '100.000000',
					used: '80.000000',
					currency: 'USD'
				}
			]
		});

		const evaluation = await service.evaluate(context({ lines: [{ id: 'L1', amount: '60.000000', quantity: 1 }] }));
		const allocated = Money.sum(
			evaluation.allocations.map((allocation) => Money.of(allocation.amount, 'USD')),
			'USD'
		);

		expect(allocated.abs().toStorageString()).toBe('20.000000');
	});

	it('applies a ten percent discount to a discounted line (fixture F-02)', async () => {
		// Doc 08 F-02: `2 x 24.99 = 49.98`, ten percent of it is `4.998`, and the adjustment is `-5.00`
		// once it reaches the currency's scale. The percentage is an exact decimal product, so a cart of
		// 49.98 evaluated at ten percent discounts rather than failing `Money.of` on
		// `4.997999999999999`.
		const spring = promotion({ id: 'promo-spring', code: 'SPRING10', title: 'Spring 10 %' });
		const { service } = world({
			promotions: [spring],
			actions: [
				action({
					id: 'act-spring',
					promotionId: spring.id,
					type: PromotionActionType.PERCENTAGE,
					targetType: PromotionActionTargetType.ITEMS,
					allocation: PromotionActionAllocation.ONCE,
					value: '10'
				})
			]
		});

		const evaluation = await service.evaluate(context({ lines: [{ id: 'L1', amount: '49.980000', quantity: 2 }] }));

		expect(Money.of(evaluation.allocations[0].amount, 'USD').toStorageString()).toBe('-5.000000');
		expect(Money.of(evaluation.result.applications[0].amount, 'USD').toStorageString()).toBe('5.000000');
	});

	it('reports a fractional total as an exact decimal rather than as a binary floating-point sum', async () => {
		// Money is an exact decimal and never a `number` (doc 07 §1.2). `evaluate` accumulates the
		// allocations as decimals through the money layer, so a cart of 0.10 + 0.20 is reported as
		// `0.300000` — the string a money column and `Money.of` accept.
		const promo = promotion({ id: 'promo-cent', code: 'CENT', title: 'Thirty cents off' });
		const { service } = world({
			promotions: [promo],
			actions: [
				action({
					id: 'act-cent',
					promotionId: promo.id,
					type: PromotionActionType.FIXED,
					value: '0.300000',
					currency: 'USD'
				})
			]
		});

		const evaluation = await service.evaluate(
			context({
				lines: [
					{ id: 'L1', amount: '0.100000', quantity: 1 },
					{ id: 'L2', amount: '0.200000', quantity: 1 }
				]
			})
		);

		expect(Money.of(evaluation.result.applications[0].amount, 'USD').toStorageString()).toBe('0.300000');
		expect(Money.of(evaluation.result.discountTotal, 'USD').abs().toStorageString()).toBe('0.300000');
	});

	it('reports a code that names no promotion as a notice', async () => {
		// Doc 08 §11 step 1: a code the caller presented that names nothing is reported. The service
		// looks it up with a read that answers with null when no row carries the code, so one mistyped
		// coupon code in a cart is a notice rather than a 404 on the whole price calculation.
		const spring = promotion({ id: 'promo-spring', code: 'SPRING10', title: 'Spring 10 %' });
		const { service } = world({
			promotions: [spring],
			actions: [action({ id: 'act-spring', promotionId: spring.id, value: '10' })]
		});

		const evaluation = await service.evaluate(context({ codes: ['SPRING10', 'NOT-A-CODE'] }));

		expect(evaluation.result.notices.map((notice) => notice.code)).toContain('NOT-A-CODE');
		expect(evaluation.result.applications).toHaveLength(1);
	});
});
