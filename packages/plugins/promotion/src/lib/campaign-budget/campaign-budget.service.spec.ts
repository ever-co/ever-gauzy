import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { RequestContext } from '@gauzy/core';
import { CampaignBudgetService } from './campaign-budget.service';
import { CampaignBudgetType } from '../promotion.types';

/**
 * Campaign budgets: the ceiling a promotion spends against, and the rule that keeps it from being
 * oversold.
 *
 * The service's own documentation is explicit that the ceiling is *never* enforced by reading `used`,
 * comparing in the application and writing back — that pattern loses exactly the race it exists to
 * prevent. So the suite drives the two observable halves of that contract:
 *
 * - an amount is consumed only while `used + amount <= limit`, and a refusal consumes nothing;
 * - two consumers reaching the last unit leave exactly one winner and a `used` that never exceeds the
 *   ceiling (P10: `0 <= used <= limit` after any interleaving);
 * - a release floors at zero, so a replayed reversal cannot drive a budget negative;
 * - a budget split by attribute gates each value on its own row, so one exhausted value does not
 *   block another (fixture F-19).
 *
 * The repository double implements the contract of the statements the service issues — the
 * conditional increment, the floored decrement and the reset — keyed on the table each statement
 * names. Nothing here touches a database, a network or the wall clock.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CAMPAIGN = '00000000-0000-4000-8000-000000000090';

interface IBudgetRow {
	id: string;
	tenantId: string;
	organizationId: string;
	campaignId: string;
	type: CampaignBudgetType;
	limit: string;
	used: string;
	attribute?: string;
	currency?: string;
}

interface IUsageRow {
	id: string;
	tenantId: string;
	organizationId: string;
	budgetId: string;
	attributeValue: string;
	used: string;
}

const budget = (overrides: Partial<IBudgetRow> = {}): IBudgetRow => ({
	id: 'budget-1',
	tenantId: TENANT,
	organizationId: ORG,
	campaignId: CAMPAIGN,
	type: CampaignBudgetType.SPEND,
	limit: '100.000000',
	used: '0',
	currency: 'USD',
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

		return expected === undefined || same(expected, value);
	});
}

function same(left: unknown, right: unknown): boolean {
	return String(left ?? '') === String(right ?? '');
}

/**
 * @param budgets The `campaign_budget` rows.
 * @param usages The `campaign_budget_usage` rows.
 * @returns The service and the two tables it writes to.
 */
function serviceUnderTest(budgets: IBudgetRow[], usages: IUsageRow[] = []) {
	const budgetRepository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			budgets.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			budgets.filter((row) => matches(row, options?.where))[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) => budgets.filter((row) => matches(row, where))[0] ?? null,
		create: (partial: IBudgetRow) => ({ id: `budget-${budgets.length + 1}`, ...partial }),
		save: async (entity: IBudgetRow) => {
			budgets.push(entity);

			return entity;
		},
		update: async (id: string, partial: Partial<IBudgetRow>) => {
			const row = budgets.find((one) => same(one.id, id));

			if (row) {
				Object.assign(row, partial);
			}

			return { affected: 1 };
		},
		/**
		 * The statements the service issues, as their contract:
		 *
		 * - an increment is admitted only while the ceiling allows it, and reports one affected row when
		 *   it was;
		 * - a decrement floors at zero;
		 * - a reset writes zero;
		 * - the per-value row is the gate, and the parent advances by the same amount.
		 */
		query: async (sql: string, values: unknown[]) => {
			// The service hands its named parameters over as positional values, so the statement's arity
			// says which of them it carries: the reset statements carry the budget id alone.
			const [first, second, third] = values;
			const onlyBudgetId = values.length === 1;
			const amount = String(onlyBudgetId ? '0' : first);
			const budgetId = onlyBudgetId ? first : second;
			const attributeValue = values.length > 2 ? String(third) : undefined;
			const row = budgets.find((one) => same(one.id, budgetId));

			if (!row) {
				return [[], 0];
			}

			if (sql.includes('campaign_budget_usage')) {
				const usage = usages.find(
					(one) => same(one.budgetId, budgetId) && same(one.attributeValue, attributeValue)
				);

				if (sql.includes('CASE WHEN')) {
					if (usage) {
						usage.used = String(Math.max(0, Number(usage.used) - Number(amount)));
					}

					return [[], 1];
				}

				if (sql.includes('= 0')) {
					// The reset targets the budget rather than one value, so it clears every row of it.
					for (const one of usages.filter((row) => same(row.budgetId, budgetId))) {
						if (attributeValue === undefined || same(one.attributeValue, attributeValue)) {
							one.used = '0';
						}
					}

					return [[], 1];
				}

				if (!usage) {
					return [[], 0];
				}
				if (Number(usage.used) + Number(amount) > Number(row.limit)) {
					return [[], 0];
				}

				usage.used = String(Number(usage.used) + Number(amount));
				row.used = String(Number(row.used) + Number(amount));

				return [[], 1];
			}

			if (sql.includes('CASE WHEN')) {
				row.used = String(Math.max(0, Number(row.used) - Number(amount)));

				return [[], 1];
			}

			if (sql.includes('= 0')) {
				row.used = '0';

				return [[], 1];
			}

			if (Number(row.used) + Number(amount) > Number(row.limit)) {
				return [[], 0];
			}

			row.used = String(Number(row.used) + Number(amount));

			return [[], 1];
		}
	};

	const usageRepository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			usages.filter((row) => matches(row, options?.where)),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			usages.filter((row) => matches(row, options?.where))[0] ?? null,
		create: (partial: IUsageRow) => ({ id: `usage-${usages.length + 1}`, ...partial }),
		// A per-value row is allocated on first use; the second writer only needs it to exist, so the
		// double keeps one row per value, as the unique index does.
		save: async (entity: IUsageRow) => {
			const existing = usages.find(
				(one) => same(one.budgetId, entity.budgetId) && same(one.attributeValue, entity.attributeValue)
			);

			if (!existing) {
				usages.push({ ...entity, used: '0' });
			}

			return entity;
		}
	};

	return {
		budgets,
		usages,
		service: new CampaignBudgetService(budgetRepository as never, {} as never, usageRepository as never)
	};
}

describe('CampaignBudgetService — the shape of a ceiling (doc 08 §12.2)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('requires an attribute path exactly for the budgets split by attribute', () => {
		const { service } = serviceUnderTest([]);

		expect(() =>
			service.assertShape({ type: CampaignBudgetType.SPEND_BY_ATTRIBUTE, limit: '100.000000', currency: 'USD' })
		).toThrow(BadRequestException);
		expect(() =>
			service.assertShape({
				type: CampaignBudgetType.SPEND_BY_ATTRIBUTE,
				limit: '100.000000',
				currency: 'USD',
				attribute: 'shipping_address.country_code'
			})
		).not.toThrow();

		expect(() => service.assertShape({ type: CampaignBudgetType.USAGE_BY_ATTRIBUTE, limit: '2' })).toThrow(
			BadRequestException
		);
		expect(() =>
			service.assertShape({
				type: CampaignBudgetType.USAGE_BY_ATTRIBUTE,
				limit: '2',
				attribute: 'shipping_address.country_code'
			})
		).not.toThrow();
	});

	it('requires a currency for a money ceiling, because it is compared with a discount', () => {
		const { service } = serviceUnderTest([]);

		expect(() => service.assertShape({ type: CampaignBudgetType.SPEND, limit: '100.000000' })).toThrow(
			BadRequestException
		);
		expect(() =>
			service.assertShape({ type: CampaignBudgetType.SPEND_BY_ATTRIBUTE, limit: '100.000000', attribute: 'country' })
		).toThrow(BadRequestException);
		expect(() =>
			service.assertShape({ type: CampaignBudgetType.SPEND, limit: '100.000000', currency: 'USD' })
		).not.toThrow();
		// A count is not money: a redemption ceiling needs no currency.
		expect(() => service.assertShape({ type: CampaignBudgetType.USAGE, limit: '2' })).not.toThrow();
	});

	it('reports the headroom as the ceiling less what is spent', () => {
		const { service } = serviceUnderTest([]);

		expect(service.headroom(budget({ limit: '100.000000', used: '80.000000' }) as never)).toBe('20');
		expect(service.headroom(budget({ limit: '100.000000', used: '100.000000' }) as never)).toBe('0');
	});
});

describe('CampaignBudgetService.reserve — a budget is never oversold (doc 08 §11.3, §12.3)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('consumes an amount that fits, and reports the headroom it saw', async () => {
		const { service, budgets } = serviceUnderTest([budget({ limit: '100.000000', used: '80.000000' })]);

		const reservation = await service.reserve('budget-1', '20.000000');

		expect(reservation).toEqual({ reserved: true, headroom: '20', amount: '20.000000' });
		expect(budgets[0].used).toBe('100');
	});

	it('refuses the amount that would break the ceiling, and consumes nothing', async () => {
		// One minor unit more than the headroom is refused: the ceiling is a ceiling.
		const { service, budgets } = serviceUnderTest([budget({ limit: '100.000000', used: '80.000000' })]);

		const reservation = await service.reserve('budget-1', '20.000001');

		expect(reservation.reserved).toBe(false);
		expect(reservation.amount).toBe('0');
		expect(reservation.headroom).toBe('20');
		expect(budgets[0].used).toBe('80.000000');
	});

	it('leaves exactly one winner when two consumers reach the last unit together', async () => {
		// The C5 race in miniature: two reservations of the whole remaining budget are issued before
		// either is awaited, and only one may take it. `used` never exceeds `limit` (P10).
		const { service, budgets } = serviceUnderTest([budget({ limit: '25.000000', used: '15.000000' })]);

		const [first, second] = await Promise.all([
			service.reserve('budget-1', '10.000000'),
			service.reserve('budget-1', '10.000000')
		]);

		expect([first.reserved, second.reserved].filter(Boolean)).toHaveLength(1);
		expect(budgets[0].used).toBe('25');
		expect(Number(budgets[0].used)).toBeLessThanOrEqual(Number(budgets[0].limit));
	});

	it('refuses a budget that is already spent rather than applying a discount anyway', async () => {
		const { service } = serviceUnderTest([budget({ limit: '100.000000', used: '100.000000' })]);

		const reservation = await service.reserve('budget-1', '1.000000');

		expect(reservation.reserved).toBe(false);
		expect(reservation.headroom).toBe('0');
	});

	it('gives each attribute value its own headroom in a budget split by attribute', async () => {
		// F-19: a 100.00 ceiling per country means CA and US each get 100.00, and exhausting CA leaves
		// US untouched.
		const { service, usages } = serviceUnderTest(
			[
				budget({
					type: CampaignBudgetType.SPEND_BY_ATTRIBUTE,
					attribute: 'shipping_address.country_code',
					limit: '100.000000',
					used: '0'
				})
			],
			[
				{ id: 'usage-ca', tenantId: TENANT, organizationId: ORG, budgetId: 'budget-1', attributeValue: 'CA', used: '0' },
				{ id: 'usage-us', tenantId: TENANT, organizationId: ORG, budgetId: 'budget-1', attributeValue: 'US', used: '0' }
			]
		);

		expect((await service.reserve('budget-1', '100.000000', 'CA')).reserved).toBe(true);
		expect((await service.reserve('budget-1', '1.000000', 'CA')).reserved).toBe(false);
		expect((await service.reserve('budget-1', '60.000000', 'US')).reserved).toBe(true);
		expect(usages.map((row) => `${row.attributeValue}:${row.used}`)).toEqual(['CA:100', 'US:60']);
	});

	it('refuses to consume an attribute budget with no value to consume against', async () => {
		const { service } = serviceUnderTest([
			budget({ type: CampaignBudgetType.USAGE_BY_ATTRIBUTE, attribute: 'items.variant.sku', limit: '2' })
		]);

		await expect(service.reserve('budget-1', '1')).rejects.toBeInstanceOf(BadRequestException);
	});

	it('refuses a budget the caller cannot see', async () => {
		const { service } = serviceUnderTest([]);

		await expect(service.reserve('budget-1', '1.000000')).rejects.toBeInstanceOf(NotFoundException);
	});
});

describe('CampaignBudgetService.release and resetConsumption (doc 08 §14.4)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('returns an amount to the pool on a reversal', async () => {
		const { service, budgets } = serviceUnderTest([budget({ limit: '100.000000', used: '60.000000' })]);

		await service.release('budget-1', '10.000000');

		expect(budgets[0].used).toBe('50');
	});

	it('floors a release at zero, so a replayed reversal cannot drive a budget negative', async () => {
		const { service, budgets } = serviceUnderTest([budget({ limit: '100.000000', used: '5.000000' })]);

		await service.release('budget-1', '50.000000');
		await service.release('budget-1', '50.000000');

		expect(budgets[0].used).toBe('0');
		expect(Number(budgets[0].used)).toBeGreaterThanOrEqual(0);
	});

	it('resets the consumption of a budget and of every per-value row', async () => {
		const { service, budgets, usages } = serviceUnderTest(
			[budget({ type: CampaignBudgetType.SPEND_BY_ATTRIBUTE, attribute: 'country', limit: '100.000000', used: '90.000000' })],
			[{ id: 'usage-ca', tenantId: TENANT, organizationId: ORG, budgetId: 'budget-1', attributeValue: 'CA', used: '90' }]
		);

		const reset = await service.resetConsumption(CAMPAIGN, 'Re-opened by an operator');

		expect(reset.used).toBe('0');
		expect(budgets[0].used).toBe('0');
		expect(usages[0].used).toBe('0');
	});

	it('reads a budget together with its per-value consumption', async () => {
		const { service } = serviceUnderTest(
			[budget({ type: CampaignBudgetType.SPEND_BY_ATTRIBUTE, attribute: 'country', used: '30.000000' })],
			[{ id: 'usage-ca', tenantId: TENANT, organizationId: ORG, budgetId: 'budget-1', attributeValue: 'CA', used: '30' }]
		);

		const view = await service.getBudget(CAMPAIGN);

		expect(view.budget.id).toBe('budget-1');
		expect(view.usage.map((row) => row.attributeValue)).toEqual(['CA']);
	});
});
