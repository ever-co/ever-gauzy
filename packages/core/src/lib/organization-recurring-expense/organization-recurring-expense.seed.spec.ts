import { IOrganization, ITenant, RecurringExpenseDefaultCategoriesEnum } from '@gauzy/contracts';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';
import {
	createDefaultOrganizationRecurringExpense,
	createRandomOrganizationRecurringExpense
} from './organization-recurring-expense.seed';

/**
 * Months are 0-based like `Date.getMonth()` everywhere else (the dialog, the edit and delete handlers and
 * `endMonth`), but the seed stored `startMonth` as `getMonth() + 1`, so every seeded expense started a month late and
 * a December start was stored as the impossible month 12.
 */
describe('organization recurring expense seeds', () => {
	const dataSource = () => {
		const saved: OrganizationRecurringExpense[] = [];
		const save = jest.fn(async (rows: OrganizationRecurringExpense[]) => {
			saved.splice(0, saved.length, ...rows);
			return rows;
		});
		return { source: { manager: { save } }, saved };
	};

	const expectZeroBasedMonths = (expenses: OrganizationRecurringExpense[]) => {
		expect(expenses.length).toBeGreaterThan(0);
		for (const expense of expenses) {
			expect(expense.startMonth).toBe(expense.startDate.getMonth());
			expect(expense.endMonth).toBe(expense.endDate.getMonth());
			expect(expense.startMonth).toBeGreaterThanOrEqual(0);
			expect(expense.startMonth).toBeLessThanOrEqual(11);
			// The handlers rebuild the date as `new Date(startYear, startMonth, startDay)`: it must be the seeded day
			expect(new Date(expense.startYear, expense.startMonth, expense.startDay).toDateString()).toBe(
				expense.startDate.toDateString()
			);
		}
	};

	it('stores startMonth 0-based for the default organization', async () => {
		const { source, saved } = dataSource();
		const organization = { id: 'o1', currency: 'USD' } as IOrganization;

		await createDefaultOrganizationRecurringExpense(source as never, { id: 't1' } as ITenant, organization);

		expect(saved).toHaveLength(Object.keys(RecurringExpenseDefaultCategoriesEnum).length);
		expectZeroBasedMonths(saved);
	});

	it('stores startMonth 0-based for random organizations', async () => {
		const { source, saved } = dataSource();
		const tenant = { id: 't1' } as ITenant;
		const organizations = Array.from({ length: 5 }, (_, i) => ({ id: `o${i}` }) as IOrganization);

		await createRandomOrganizationRecurringExpense(source as never, [tenant], new Map([[tenant, organizations]]));

		expectZeroBasedMonths(saved);
	});
});
