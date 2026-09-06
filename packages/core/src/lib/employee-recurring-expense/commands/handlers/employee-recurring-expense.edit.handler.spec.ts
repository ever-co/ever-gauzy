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

import { StartDateUpdateTypeEnum } from '@gauzy/contracts';
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

// Distinguishes "the handler wrote employeeId: undefined" from "the handler left the key off
// entirely", which is the whole point of the untouched cases.
const UNTOUCHED = Symbol('employeeId not written');

const STORED_EXPENSE = {
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

function makeFakeCrudService() {
	return {
		findOneByIdString: jest.fn().mockResolvedValue(STORED_EXPENSE),
		update: jest.fn().mockResolvedValue({}),
		create: jest.fn().mockResolvedValue({})
	};
}

function edit(crudService: ReturnType<typeof makeFakeCrudService>, overrides: Record<string, unknown>) {
	// The QueryBus is only used by `execute()`, which resolves the start-date update type before
	// delegating; `executeCommand()` takes an explicit type, so the bus is never touched.
	const handler = new EmployeeRecurringExpenseEditHandler(crudService as any, {} as any);

	return handler.executeCommand('expense-1', {
		startDay: 1,
		startMonth: 1,
		startYear: 2026,
		categoryName: 'Travel',
		value: 250,
		currency: 'USD',
		...overrides
	} as any);
}

function expectEmployeeId(written: Record<string, any>, expected: unknown) {
	if (expected === UNTOUCHED) {
		expect(written).not.toHaveProperty('employeeId');
	} else {
		expect(written).toHaveProperty('employeeId', expected);
	}
}

describe('EmployeeRecurringExpenseEditHandler', () => {
	// Every case except the permission suite speaks for a caller who is allowed to pick an
	// employee. With no live request `RequestContext.hasPermission` reads false, which would send
	// them all down the restricted branch and quietly test the wrong thing.
	beforeEach(() => {
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	// `undefined` means the caller never mentioned the field; `''` is not a valid id and not the
	// "untouched" signal, but `EmployeeFeatureDTO` types employeeId with `@IsString()`, which
	// accepts it, so it can genuinely arrive.
	describe('a same-month edit (NO_CHANGE / WITHIN_MONTH / REDUCE_SAFE -> updateExpenseStartDateAndValue)', () => {
		it.each([
			['persists an explicit null, switching the expense to "All Employees"', null, null],
			['persists a specific employee id', 'employee-2', 'employee-2'],
			['leaves the assignment alone when employeeId is absent', undefined, UNTOUCHED],
			['leaves the assignment alone for an empty-string employeeId', '', UNTOUCHED]
		])('%s', async (_label, submitted, expected) => {
			const crudService = makeFakeCrudService();

			await edit(crudService, {
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: submitted
			});

			expectEmployeeId(crudService.update.mock.calls[0][1], expected);
		});
	});

	// Same three meanings, but this path builds a replacement row, so "untouched" means the new row
	// inherits the employee the original expense carried.
	describe('a later-month edit that is safe to apply (INCREASE_SAFE_WITHIN_LIMIT -> increaseSafe)', () => {
		it.each([
			['applies an explicit null rather than copying the original employee', null, null],
			['applies a specific employee id', 'employee-2', 'employee-2'],
			['carries the original employee forward when employeeId is absent', undefined, 'employee-1'],
			['carries the original employee forward for an empty-string employeeId', '', 'employee-1']
		])('%s', async (_label, submitted, expected) => {
			const crudService = makeFakeCrudService();

			await edit(crudService, {
				startMonth: 5,
				startDateUpdateType: StartDateUpdateTypeEnum.INCREASE_SAFE_WITHIN_LIMIT,
				employeeId: submitted
			});

			expectEmployeeId(crudService.create.mock.calls[0][0], expected);
		});
	});

	// `TenantAwareCrudService.update()` scopes the row to the caller's tenant but applies no
	// employee guard of its own, so this override is the only thing between an unprivileged caller
	// and reassigning an expense. `EmployeeRecurringExpenseCreateHandler` enforces the same rule on
	// create; the two paths must not diverge.
	describe('a caller without CHANGE_SELECTED_EMPLOYEE', () => {
		beforeEach(() => {
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('caller-employee');
		});

		it.each([
			['another employee', 'someone-else'],
			['"All Employees"', null],
			['no employee at all', undefined]
		])('writes only their own employee id, never %s', async (_label, submitted) => {
			const crudService = makeFakeCrudService();

			await edit(crudService, {
				startDateUpdateType: StartDateUpdateTypeEnum.NO_CHANGE,
				employeeId: submitted
			});

			expectEmployeeId(crudService.update.mock.calls[0][1], 'caller-employee');
		});
	});
});
