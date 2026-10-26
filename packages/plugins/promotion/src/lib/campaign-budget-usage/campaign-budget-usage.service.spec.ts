import { RequestContext } from '@gauzy/core';
import { CampaignBudgetUsageService } from './campaign-budget-usage.service';

/**
 * The per-attribute-value rows of a campaign budget, and the one figure this service derives from
 * them.
 *
 * `totalFor` is what the nightly audit compares the parent budget's `used` against, and the parent's
 * `used` was advanced by SQL — `used = used + :amount` on a `numeric(20,6)` column — so it holds an
 * exact decimal. Summing the same rows with `+` on doubles therefore does not reproduce it: three
 * rows of 10.000000, 10.010000 and 0.000000 came back as `'20.009999999999998'`, and the audit
 * reported a disagreement that was entirely its own, for ever, with nothing to repair. A sub-microunit
 * total came back in exponential notation, which is not a decimal string at all, so a caller that fed
 * the result to `Money.of` was handed an exception instead of a total.
 *
 * The suite therefore pins the property rather than the implementation: the sum of the rows is exact,
 * it is always a decimal string at the storage scale, and it is the figure an exact ledger would hold.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const BUDGET = '00000000-0000-4000-8000-000000000090';

/** One `campaign_budget_usage` row. */
interface IUsageRow {
	id: string;
	tenantId: string;
	organizationId: string;
	budgetId: string;
	attributeValue: string;
	used: string;
}

/**
 * @param rows The per-value rows the budget holds.
 * @returns The service over an in-memory stand-in for its repository.
 */
function serviceUnderTest(rows: IUsageRow[]) {
	const repository = {
		find: async (options?: { where?: Record<string, unknown> }) =>
			rows.filter((row) =>
				Object.entries(options?.where ?? {}).every(
					([field, expected]) =>
						expected === undefined ||
						String((row as unknown as Record<string, unknown>)[field] ?? '') === String(expected)
				)
			),
		findOne: async (options?: { where?: Record<string, unknown> }) =>
			(await repository.find(options))[0] ?? null,
		findOneBy: async (where?: Record<string, unknown>) => (await repository.find({ where }))[0] ?? null
	};

	return { rows, service: new CampaignBudgetUsageService(repository as never, {} as never) };
}

/**
 * @param overrides What the row states.
 * @returns A per-value row of the fixture's budget.
 */
const usage = (overrides: Partial<IUsageRow> & { id: string; attributeValue: string; used: string }): IUsageRow => ({
	tenantId: TENANT,
	organizationId: ORG,
	budgetId: BUDGET,
	...overrides
});

describe('CampaignBudgetUsageService.totalFor — the figure the audit compares', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('sums the rows exactly, where a float accumulation would not', async () => {
		const { service } = serviceUnderTest([
			usage({ id: 'u-1', attributeValue: 'CA', used: '10.000000' }),
			usage({ id: 'u-2', attributeValue: 'US', used: '10.010000' }),
			usage({ id: 'u-3', attributeValue: 'GB', used: '0.000000' })
		]);

		// The control: this is what the audit was comparing the exact parent figure against.
		expect(String(0 + 10 + 10.01)).toBe('20.009999999999998');
		expect(await service.totalFor(BUDGET)).toBe('20.010000');
	});

	it('reports a sub-microunit total as a decimal rather than in exponential notation', async () => {
		const { service } = serviceUnderTest([usage({ id: 'u-1', attributeValue: 'CA', used: '0.000001' })]);

		expect(await service.totalFor(BUDGET)).toBe('0.000001');
	});

	it('answers zero at the storage scale for a budget nobody has consumed', async () => {
		const { service } = serviceUnderTest([]);

		expect(await service.totalFor(BUDGET)).toBe('0.000000');
	});

	it('counts only the rows of the budget it was asked about', async () => {
		const { service } = serviceUnderTest([
			usage({ id: 'u-1', attributeValue: 'CA', used: '5.000000' }),
			usage({ id: 'u-2', attributeValue: 'CA', used: '7.000000', budgetId: 'another-budget' })
		]);

		expect(await service.totalFor(BUDGET)).toBe('5.000000');
	});

	it('reads a row that carries no consumption at all as nothing', async () => {
		// The column is `NOT NULL DEFAULT 0`, but a row read back through a double or an older ORM
		// mapping can arrive without it, and a total that becomes `NaN` is worse than one that is short.
		const { service } = serviceUnderTest([
			usage({ id: 'u-1', attributeValue: 'CA', used: undefined as never }),
			usage({ id: 'u-2', attributeValue: 'US', used: '2.500000' })
		]);

		expect(await service.totalFor(BUDGET)).toBe('2.500000');
	});
});
