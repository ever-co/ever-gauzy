import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import { EmployeeRecurringExpense } from './employee-recurring-expense.entity';
import { createRandomEmployeeRecurringExpense } from './employee-recurring-expense.seed';

/**
 * Months are 0-based like `Date.getMonth()` everywhere else (the dialog, the DTO, the edit and delete handlers and
 * `endMonth`), but the seed stored `startMonth` as `getMonth() + 1`, so every seeded expense started a month late and
 * a December start was stored as the impossible month 12.
 */
describe('createRandomEmployeeRecurringExpense', () => {
	const seed = async (): Promise<EmployeeRecurringExpense[]> => {
		let inserted: EmployeeRecurringExpense[] = [];
		const builder = {
			insert: () => builder,
			into: () => builder,
			values: (values: EmployeeRecurringExpense[]) => {
				inserted = values;
				return builder;
			},
			execute: jest.fn()
		};
		const dataSource = { createQueryBuilder: () => builder };

		const tenant = { id: 't1' } as ITenant;
		const organization = { id: 'o1' } as IOrganization;
		const employees = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}` }) as IEmployee);

		await createRandomEmployeeRecurringExpense(
			dataSource as never,
			[tenant],
			new Map([[tenant, [organization]]]),
			new Map([[organization, employees]])
		);
		return inserted;
	};

	it('stores startMonth 0-based, matching startDate', async () => {
		const expenses = await seed();

		expect(expenses).toHaveLength(40);
		for (const expense of expenses) {
			expect(expense.startMonth).toBe(expense.startDate.getMonth());
			expect(expense.startMonth).toBeGreaterThanOrEqual(0);
			expect(expense.startMonth).toBeLessThanOrEqual(11);
			// The handlers rebuild the date as `new Date(startYear, startMonth, startDay)`: it must be the seeded day
			expect(new Date(expense.startYear, expense.startMonth, expense.startDay).toDateString()).toBe(
				expense.startDate.toDateString()
			);
		}
	});

	it('keeps endMonth 0-based, matching endDate', async () => {
		const ended = (await seed()).filter((expense) => expense.endDate);

		expect(ended.length).toBeGreaterThan(0);
		for (const expense of ended) {
			expect(expense.endMonth).toBe(expense.endDate.getMonth());
		}
	});
});
