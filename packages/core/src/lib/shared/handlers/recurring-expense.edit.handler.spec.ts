import { StartDateUpdateTypeEnum } from '@gauzy/contracts';

/**
 * `RecurringExpenseEditHandler` is shared by employee recurring expenses (which have an
 * `employeeId` column) and organization recurring expenses (which do not). Only the employee
 * subclass may ever write an employee assignment, so this suite pins the base class's half of that
 * contract: `assignEmployeeId` is a no-op here, and no write path may smuggle an `employeeId`
 * through on its own.
 *
 * That matters because `OrganizationRecurringExpenseController.update` takes a raw `@Body()` with
 * no DTO and no validation pipe, so an `employeeId` in the request body reaches this handler
 * unfiltered. Writing it onto an `OrganizationRecurringExpense` would hand the ORM a column that
 * does not exist. The employee-side behavior — where the assignment is actually resolved — lives in
 * `employee-recurring-expense/commands/handlers/employee-recurring-expense.edit.handler.spec.ts`.
 *
 * `../../core` is mocked out entirely: the handler only uses it for the `CrudService` *type*
 * (erased at compile time; we pass a fake object) and the tiny `getLastDayOfMonth` helper
 * (reimplemented below), but that barrel also re-exports the full entity/module graph for the whole
 * app — pulling in the real thing here would turn a focused handler test into something that needs
 * half the monorepo's dependencies just to import.
 */
jest.mock('../../core', () => ({
	getLastDayOfMonth: (year: number, month: number) => new Date(year, month + 1, 0).getDate()
}));

import { RecurringExpenseEditHandler } from './recurring-expense.edit.handler';

class TestRecurringExpenseEditHandler extends RecurringExpenseEditHandler<any> {}

// An organization recurring expense: no employeeId anywhere on the stored row.
const ORGANIZATION_EXPENSE = {
	id: 'expense-1',
	organizationId: 'org-1',
	splitExpense: false,
	categoryName: 'Software',
	currency: 'EUR',
	parentRecurringExpenseId: 'parent-1',
	endYear: 2027,
	endMonth: 6,
	endDay: 30
};

describe('RecurringExpenseEditHandler (shared base)', () => {
	let crudService: {
		findOneByIdString: jest.Mock;
		update: jest.Mock;
		create: jest.Mock;
	};
	let handler: TestRecurringExpenseEditHandler;

	function arrange(storedExpense: Record<string, unknown> = ORGANIZATION_EXPENSE) {
		crudService = {
			findOneByIdString: jest.fn().mockResolvedValue(storedExpense),
			update: jest.fn().mockResolvedValue({}),
			create: jest.fn().mockResolvedValue({})
		};
		handler = new TestRecurringExpenseEditHandler(crudService as any);
	}

	// Values deliberately unlike the employee suite's fixture: these two suites cover different
	// classes and share no setup, so nothing here should be mistaken for the employee case.
	function edit(overrides: Record<string, unknown>) {
		return handler.executeCommand('expense-1', {
			startDay: 15,
			startMonth: 3,
			startYear: 2027,
			categoryName: 'Software',
			value: 99,
			currency: 'EUR',
			...overrides
		} as any);
	}

	describe('assignEmployeeId', () => {
		it('is a no-op, so an organization recurring expense can never be given an employee', () => {
			arrange();
			const target: Record<string, any> = {};

			(handler as any).assignEmployeeId(target, { employeeId: 'employee-1' }, { employeeId: 'employee-2' });

			expect(target).toEqual({});
		});
	});

	describe('a same-month edit (NO_CHANGE / WITHIN_MONTH / REDUCE_SAFE)', () => {
		it.each([['a specific id', 'employee-1'], ['an explicit null', null]])(
			'applies the start date and value but writes no employeeId, given %s',
			async (_label, employeeId) => {
				arrange();

				await edit({ startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE, employeeId });

				const [, written] = crudService.update.mock.calls[0];
				expect(written).toMatchObject({ startDay: 15, startMonth: 3, startYear: 2027, value: 99 });
				expect(written).not.toHaveProperty('employeeId');
			}
		);
	});

	describe('a later-month edit that is safe to apply (INCREASE_SAFE_WITHIN_LIMIT)', () => {
		it('carries the organization onto the replacement expense', async () => {
			arrange();

			await edit({ startMonth: 8, startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT });

			expect(crudService.create.mock.calls[0][0]).toMatchObject({
				organizationId: 'org-1',
				parentRecurringExpenseId: 'parent-1'
			});
		});

		it('writes no employeeId onto the replacement expense, even when the stored row has one', async () => {
			arrange({ ...ORGANIZATION_EXPENSE, employeeId: 'employee-1' });

			await edit({
				startMonth: 8,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT,
				employeeId: 'employee-2'
			});

			expect(crudService.create.mock.calls[0][0]).not.toHaveProperty('employeeId');
		});
	});
});
