import { IRecurringExpenseEditInput, StartDateUpdateTypeEnum } from '@gauzy/contracts';

/**
 * `RecurringExpenseEditHandler` is shared between employee recurring expenses (which carry an
 * `employeeId`) and organization recurring expenses (which never do). Before this fix, editing an
 * employee recurring expense back to "All Employees" (`employeeId: null`) reached this handler and
 * was silently discarded:
 *  - `updateExpenseStartDateAndValue` never copied `employeeId` from the input at all, so the
 *    NO_CHANGE / WITHIN_MONTH / REDUCE_SAFE update paths left the previous employee in place.
 *  - `increaseSafe`'s replacement-expense path unconditionally copied `originalExpense.employeeId`
 *    onto the new row whenever it was truthy, ignoring whatever the caller actually submitted.
 * The request returned 2xx either way, so this was invisible from the HTTP response — it just
 * never actually changed the assignment (#8889).
 *
 * These tests exercise the handler directly against a fake `CrudService`, with no NestJS module,
 * database, or HTTP layer involved. `../../core` is mocked out entirely: the handler only uses it
 * for the `CrudService` *type* (erased at compile time; we pass a fake object) and the tiny
 * `getLastDayOfMonth` helper (reimplemented below), but that barrel also re-exports the full
 * entity/module graph for the whole app — pulling in the real thing here would turn a focused
 * handler test into something that needs half the monorepo's dependencies just to import.
 */
jest.mock('../../core', () => ({
	getLastDayOfMonth: (year: number, month: number) => new Date(year, month + 1, 0).getDate()
}));

import { RecurringExpenseEditHandler } from './recurring-expense.edit.handler';

class TestRecurringExpenseEditHandler extends RecurringExpenseEditHandler<any> {}

function makeFakeCrudService(originalExpense: Record<string, unknown>) {
	return {
		findOneByIdString: jest.fn().mockResolvedValue(originalExpense),
		update: jest.fn().mockResolvedValue({}),
		create: jest.fn().mockResolvedValue({})
	};
}

const BASE_INPUT: IRecurringExpenseEditInput = {
	startDay: 1,
	startMonth: 1,
	startYear: 2026,
	categoryName: 'Travel',
	value: 250,
	currency: 'USD'
};

describe('RecurringExpenseEditHandler', () => {
	describe('a same-month edit (NO_CHANGE / WITHIN_MONTH / REDUCE_SAFE -> updateExpenseStartDateAndValue)', () => {
		it('clears the employee assignment when the input explicitly sets employeeId to null', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1', employeeId: 'employee-1' });
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: null
			});

			expect(crudService.update).toHaveBeenCalledWith(
				'expense-1',
				expect.objectContaining({ employeeId: null })
			);
		});

		it('leaves the employee assignment untouched when the input never mentions employeeId', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1', employeeId: 'employee-1' });
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE
			});

			const updatePayload = crudService.update.mock.calls[0][1];
			expect(updatePayload).not.toHaveProperty('employeeId');
		});
	});

	describe('a later-month edit that is safe to apply (INCREASE_SAFE_WITHIN_LIMIT -> increaseSafe)', () => {
		const originalExpense = {
			id: 'expense-1',
			employeeId: 'employee-1',
			organizationId: 'org-1',
			splitExpense: false,
			categoryName: 'Travel',
			currency: 'USD',
			parentRecurringExpenseId: 'parent-1',
			endYear: 2026,
			endMonth: 2,
			endDay: 28
		};

		it('applies the caller\'s employeeId: null to the replacement expense instead of copying the original employee', async () => {
			const crudService = makeFakeCrudService(originalExpense);
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startMonth: 5,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT,
				employeeId: null
			});

			expect(crudService.create).toHaveBeenCalledWith(
				expect.objectContaining({ employeeId: null })
			);
		});

		it('still carries the original employee forward when the input never mentions employeeId', async () => {
			const crudService = makeFakeCrudService(originalExpense);
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startMonth: 5,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT
			});

			expect(crudService.create).toHaveBeenCalledWith(
				expect.objectContaining({ employeeId: 'employee-1' })
			);
		});
	});
});
