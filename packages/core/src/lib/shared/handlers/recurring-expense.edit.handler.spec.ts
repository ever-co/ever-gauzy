import { IRecurringExpenseEditInput, StartDateUpdateTypeEnum } from '@gauzy/contracts';

/**
 * `RecurringExpenseEditHandler` is shared by employee recurring expenses (which have an
 * `employeeId` column) and organization recurring expenses (which do not). Only the employee
 * subclass may ever write an employee assignment, so this suite pins the base class's half of that
 * contract: it must leave `employeeId` alone no matter what the caller sent.
 *
 * That matters because `OrganizationRecurringExpenseController.update` takes a raw `@Body()` with
 * no DTO and no validation pipe, so an `employeeId` in the request body reaches this handler
 * unfiltered. Writing it onto an `OrganizationRecurringExpense` would hand the ORM a column that
 * does not exist. The employee-side behavior is covered in
 * `employee-recurring-expense/commands/handlers/employee-recurring-expense.edit.handler.spec.ts`.
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

describe('RecurringExpenseEditHandler (shared base)', () => {
	describe('a same-month edit (NO_CHANGE / WITHIN_MONTH / REDUCE_SAFE -> updateExpenseStartDateAndValue)', () => {
		it('still applies the start date and value changes', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1' });
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE
			});

			expect(crudService.update).toHaveBeenCalledWith(
				'expense-1',
				expect.objectContaining({ startDay: 1, startMonth: 1, startYear: 2026, value: 250 })
			);
		});

		it('never writes employeeId, even when the caller supplied one', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1' });
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: 'employee-1'
			});

			expect(crudService.update.mock.calls[0][1]).not.toHaveProperty('employeeId');
		});

		it('never writes employeeId when the caller sent an explicit null', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1' });
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: null
			});

			expect(crudService.update.mock.calls[0][1]).not.toHaveProperty('employeeId');
		});
	});

	describe('a later-month edit that is safe to apply (INCREASE_SAFE_WITHIN_LIMIT -> increaseSafe)', () => {
		const originalExpense = {
			id: 'expense-1',
			organizationId: 'org-1',
			splitExpense: false,
			categoryName: 'Travel',
			currency: 'USD',
			parentRecurringExpenseId: 'parent-1',
			endYear: 2026,
			endMonth: 2,
			endDay: 28
		};

		it('creates the replacement expense carrying the organization forward', async () => {
			const crudService = makeFakeCrudService(originalExpense);
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startMonth: 5,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT
			});

			expect(crudService.create).toHaveBeenCalledWith(
				expect.objectContaining({ organizationId: 'org-1', parentRecurringExpenseId: 'parent-1' })
			);
		});

		it('never writes employeeId onto the replacement expense, whatever the caller sent', async () => {
			const crudService = makeFakeCrudService({ ...originalExpense, employeeId: 'employee-1' });
			const handler = new TestRecurringExpenseEditHandler(crudService as any);

			await handler.executeCommand('expense-1', {
				...BASE_INPUT,
				startMonth: 5,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT,
				employeeId: 'employee-2'
			});

			expect(crudService.create.mock.calls[0][0]).not.toHaveProperty('employeeId');
		});
	});
});
