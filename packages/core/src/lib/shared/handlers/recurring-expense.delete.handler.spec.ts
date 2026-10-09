import { RecurringExpenseDeletionEnum } from '@gauzy/contracts';

/**
 * Deleting one month in the middle of a recurring expense ends the expense the month before and creates a copy
 * that starts the month after. Months are 0-based (December = 11), and the copy's `startMonth` / `startYear` used
 * to be `month + 1` / `year` verbatim, so deleting a December produced `startMonth: 12` in the old year while its
 * `startDate` was already January of the next year.
 *
 * `../../core` is mocked out for the same reason as in `recurring-expense.edit.handler.spec.ts`.
 */
jest.mock('../../core', () => ({
	getLastDayOfMonth: (year: number, month: number) => new Date(year, month + 1, 0).getDate()
}));

import { RecurringExpenseDeleteHandler } from './recurring-expense.delete.handler';

class TestRecurringExpenseDeleteHandler extends RecurringExpenseDeleteHandler<any> {}

describe('RecurringExpenseDeleteHandler — delete one month only', () => {
	// Open-ended expense that started in January 2025
	const storedExpense = {
		id: 'expense-1',
		organizationId: 'org-1',
		categoryName: 'Rent',
		currency: 'EUR',
		value: 1200,
		parentRecurringExpenseId: 'parent-1',
		startDate: new Date(2025, 0, 1),
		endDate: null,
		endMonth: null,
		endYear: null
	};

	let crudService: { findOneByIdString: jest.Mock; update: jest.Mock; create: jest.Mock; delete: jest.Mock };
	let handler: TestRecurringExpenseDeleteHandler;

	beforeEach(() => {
		crudService = {
			findOneByIdString: jest.fn().mockResolvedValue(storedExpense),
			update: jest.fn().mockResolvedValue({}),
			create: jest.fn().mockResolvedValue({}),
			delete: jest.fn()
		};
		handler = new TestRecurringExpenseDeleteHandler(crudService as any);
	});

	const deleteMonth = (year: number, month: number) =>
		handler.executeCommand('expense-1', { deletionType: RecurringExpenseDeletionEnum.CURRENT, year, month });

	it('restarts the expense in January of the next year when a December is deleted', async () => {
		await deleteMonth(2025, 11);

		expect(crudService.create.mock.calls[0][0]).toMatchObject({
			startDay: 1,
			startMonth: 0,
			startYear: 2026,
			startDate: new Date(2026, 0, 1)
		});
	});

	it('restarts the expense the month after the deleted one within the same year', async () => {
		await deleteMonth(2025, 5);

		expect(crudService.create.mock.calls[0][0]).toMatchObject({
			startMonth: 6,
			startYear: 2025,
			startDate: new Date(2025, 6, 1)
		});
	});

	it('ends the original expense the month before the deleted one', async () => {
		await deleteMonth(2025, 11);

		expect(crudService.update).toHaveBeenCalledWith('expense-1', {
			endDay: 30,
			endMonth: 10,
			endYear: 2025,
			endDate: new Date(2025, 10, 30)
		});
	});
});
