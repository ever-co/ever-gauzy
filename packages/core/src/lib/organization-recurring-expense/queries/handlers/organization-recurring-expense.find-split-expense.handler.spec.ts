import '../../../core/entities/internal';

import { FindOperator } from 'typeorm';
import { OrganizationRecurringExpenseFindSplitExpenseQuery } from '../organization-recurring-expense.find-split-expense.query';
import { OrganizationRecurringExpenseFindSplitExpenseHandler } from './organization-recurring-expense.find-split-expense.handler';

/**
 * The split recurring expenses of a month are those running during it. Both dates were compared with the
 * 1st of the month only, so an expense starting on the 15th was missing from its first month.
 */
describe('OrganizationRecurringExpenseFindSplitExpenseHandler', () => {
	it('selects the expenses running during the month, including one starting after the 1st', async () => {
		const findAll = jest.fn().mockResolvedValue({ items: [{ value: 300 }], total: 1 });
		const handler = new OrganizationRecurringExpenseFindSplitExpenseHandler(
			{ findAll } as any,
			{ findOneByWhereOptions: jest.fn().mockResolvedValue({ id: 'org-1' }) } as any,
			{ findAll: jest.fn().mockResolvedValue({ items: [], total: 3 }) } as any
		);

		const result = await handler.execute(
			new OrganizationRecurringExpenseFindSplitExpenseQuery('org-1', { year: 2026, month: 2 } as any)
		);

		const [openEnded, ending] = findAll.mock.calls[0][0].where;
		const valueOf = (operator: FindOperator<Date>) => operator.value;
		const endOfMarch = new Date(2026, 2, 31, 23, 59, 59, 999);

		// Started by the end of the month (an expense from March 15 counts for March)
		expect(openEnded.startDate.type).toBe('lessThanOrEqual');
		expect(valueOf(openEnded.startDate)).toEqual(endOfMarch);
		expect(ending.startDate.type).toBe('lessThanOrEqual');
		expect(valueOf(ending.startDate)).toEqual(endOfMarch);
		// Open-ended, or ending on or after the start of the month
		expect(openEnded.endDate.type).toBe('isNull');
		expect(ending.endDate.type).toBe('moreThanOrEqual');
		expect(valueOf(ending.endDate)).toEqual(new Date(2026, 2, 1));
		expect(result.items[0]).toMatchObject({ value: 100, originalValue: 300, employeeCount: 3 });
	});
});
