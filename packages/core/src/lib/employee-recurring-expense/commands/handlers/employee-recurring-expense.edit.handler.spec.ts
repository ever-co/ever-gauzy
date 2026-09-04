/**
 * Importing anything under `employee/**` pulls in `shared/validators`, which reaches
 * `employee.entity` -> `core/entities/internal` -> `dashboard.entity`, which applies
 * `@IsEmployeeBelongsToOrganization()` while `shared/validators` is still initializing. Entering
 * that cycle from this side leaves the decorator undefined and the suite dies at import time with
 * "IsEmployeeBelongsToOrganization is not a function". Loading the entity graph FIRST resolves the
 * cycle in the order the application itself uses, so this side-effect import must stay above the
 * others.
 */
import '../../../core/entities/internal';

import { IRecurringExpenseEditInput, StartDateUpdateTypeEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EmployeeRecurringExpenseEditHandler } from './employee-recurring-expense.edit.handler';

/**
 * Employee recurring expenses are the only flavour with an `employeeId`, so
 * `EmployeeRecurringExpenseEditHandler` overrides `assignEmployeeId` to resolve the assignment
 * (the shared base class deliberately writes nothing — see the sibling spec in
 * `shared/handlers/recurring-expense.edit.handler.spec.ts`).
 *
 * Before this fix, editing an employee recurring expense back to "All Employees"
 * (`employeeId: null`) was silently discarded:
 *  - `updateExpenseStartDateAndValue` never copied `employeeId` from the input at all, so the
 *    NO_CHANGE / WITHIN_MONTH / REDUCE_SAFE update paths left the previous employee in place.
 *  - `increaseSafe`'s replacement-expense path unconditionally copied `originalExpense.employeeId`
 *    onto the new row whenever it was truthy, ignoring whatever the caller actually submitted.
 * The request returned 2xx either way, so this was invisible from the HTTP response — it just
 * never actually changed the assignment (#8889).
 *
 * The handler is exercised directly against a fake `CrudService`: `executeCommand` is the seam
 * below the CQRS/HTTP layers, so no NestJS module, database or query bus is needed.
 */
function makeFakeCrudService(originalExpense: Record<string, unknown>) {
	return {
		findOneByIdString: jest.fn().mockResolvedValue(originalExpense),
		update: jest.fn().mockResolvedValue({}),
		create: jest.fn().mockResolvedValue({})
	};
}

function makeHandler(crudService: ReturnType<typeof makeFakeCrudService>) {
	// The QueryBus is only used by `execute()`, which resolves the start-date update type before
	// delegating; these tests call `executeCommand()` with an explicit type, so it is never touched.
	return new EmployeeRecurringExpenseEditHandler(crudService as any, {} as any);
}

const BASE_INPUT: IRecurringExpenseEditInput = {
	startDay: 1,
	startMonth: 1,
	startYear: 2026,
	categoryName: 'Travel',
	value: 250,
	currency: 'USD'
};

describe('EmployeeRecurringExpenseEditHandler', () => {
	// Every case below except the permission suite speaks for a caller who is allowed to pick an
	// employee. Without a live request `RequestContext.hasPermission` is false, which would send
	// them all down the restricted branch and test the wrong thing.
	beforeEach(() => {
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('a caller without CHANGE_SELECTED_EMPLOYEE', () => {
		// `TenantAwareCrudService.update()` scopes the row to the caller's tenant but applies no
		// employee guard of its own, so this is the only thing standing between an unprivileged
		// caller and reassigning an expense. `EmployeeRecurringExpenseCreateHandler` enforces the
		// same rule on create; the two paths must not diverge.
		beforeEach(() => {
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('caller-employee');
		});

		it('cannot reassign an expense to another employee', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1', employeeId: 'caller-employee' });

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: 'someone-else'
			});

			expect(crudService.update).toHaveBeenCalledWith(
				'expense-1',
				expect.objectContaining({ employeeId: 'caller-employee' })
			);
		});

		it('cannot switch an expense to "All Employees"', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1', employeeId: 'caller-employee' });

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: null
			});

			expect(crudService.update).toHaveBeenCalledWith(
				'expense-1',
				expect.objectContaining({ employeeId: 'caller-employee' })
			);
		});
	});

	describe('a same-month edit (NO_CHANGE / WITHIN_MONTH / REDUCE_SAFE -> updateExpenseStartDateAndValue)', () => {
		it('clears the employee assignment when the input explicitly sets employeeId to null', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1', employeeId: 'employee-1' });

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: null
			});

			expect(crudService.update).toHaveBeenCalledWith(
				'expense-1',
				expect.objectContaining({ employeeId: null })
			);
		});

		it('applies a specific employeeId when the input names one', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1', employeeId: 'employee-1' });

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: 'employee-2'
			});

			expect(crudService.update).toHaveBeenCalledWith(
				'expense-1',
				expect.objectContaining({ employeeId: 'employee-2' })
			);
		});

		it('leaves the employee assignment untouched when the input never mentions employeeId', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1', employeeId: 'employee-1' });

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE
			});

			expect(crudService.update.mock.calls[0][1]).not.toHaveProperty('employeeId');
		});

		it('does not persist an empty-string employeeId (not a valid id, and not the "untouched" signal)', async () => {
			const crudService = makeFakeCrudService({ id: 'expense-1', employeeId: 'employee-1' });

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: ''
			});

			expect(crudService.update.mock.calls[0][1]).not.toHaveProperty('employeeId');
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

		it("applies the caller's employeeId: null to the replacement expense instead of copying the original employee", async () => {
			const crudService = makeFakeCrudService(originalExpense);

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startMonth: 5,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT,
				employeeId: null
			});

			expect(crudService.create).toHaveBeenCalledWith(expect.objectContaining({ employeeId: null }));
		});

		it('still carries the original employee forward when the input never mentions employeeId', async () => {
			const crudService = makeFakeCrudService(originalExpense);

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startMonth: 5,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT
			});

			expect(crudService.create).toHaveBeenCalledWith(
				expect.objectContaining({ employeeId: 'employee-1' })
			);
		});

		it('falls back to the original employee, not an empty-string employeeId, on the replacement expense', async () => {
			const crudService = makeFakeCrudService(originalExpense);

			await makeHandler(crudService).executeCommand('expense-1', {
				...BASE_INPUT,
				startMonth: 5,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT,
				employeeId: ''
			});

			expect(crudService.create).toHaveBeenCalledWith(
				expect.objectContaining({ employeeId: 'employee-1' })
			);
		});
	});
});
