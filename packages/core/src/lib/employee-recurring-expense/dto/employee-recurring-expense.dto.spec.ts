/**
 * Importing either DTO pulls in `employee/dto` -> `core/dto` -> `shared/validators`, which reaches
 * `employee.entity` -> `core/entities/internal` -> `dashboard.entity`, which applies
 * `@IsEmployeeBelongsToOrganization()` while `shared/validators` is still initializing. Entering
 * that cycle from this side leaves the decorator undefined and the suite dies at import time with
 * "IsEmployeeBelongsToOrganization is not a function". Loading the entity graph FIRST resolves the
 * cycle in the order the application itself uses, so this side-effect import must stay above the
 * others.
 */
import '../../core/entities/internal';

import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateEmployeeRecurringExpenseDTO } from './create-employee-recurring-expense.dto';
import { UpdateEmployeeRecurringExpenseDTO } from './update-employee-recurring-expense.dto';

/**
 * The create and update endpoints both run `@UseValidationPipe({ transform: true })` over a DTO
 * that intersects `EmployeeFeatureDTO`, and both have to accept an expense with no employee.
 *
 * The "All Employees" option on the Add-expense dialog (`ga-employee-selector` with
 * `showAllEmployeesOption`) submits the ALL_EMPLOYEES_SELECTED sentinel, whose `id` is `null`,
 * which `RecurringExpensesEmployeeComponent` (`_recurringExpenseMutationResultTransform`) turns
 * into `{ employeeId: null }` with no `employee` key at all — a legitimate org-level recurring
 * expense with no specific employee attached.
 *
 * Before this fix, `EmployeeFeatureDTO`'s `@ValidateIf` pair still forced `@IsObject()` on the
 * missing `employee` and `@IsString()` on the null `employeeId`, so BOTH failed and every "All
 * Employees" recurring expense was rejected with an HTTP 400 (#8889) — reproducible purely from
 * the DTO, with no server or database involved. A previous attempt (#8899) worked around this by
 * removing the "All Employees" option from the UI instead of fixing the validation, and was
 * reverted (#8900) because the option is meant to work.
 *
 * The two DTOs are deliberately exercised through the same table: they must not drift apart, since
 * an expense that can be created for "All Employees" but not edited back to it is the same bug.
 * The edit handler's own half of #8889 — discarding that null and keeping the previous employee —
 * is covered in `commands/handlers/employee-recurring-expense.edit.handler.spec.ts`.
 */

const VALID_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000001';

// `EmployeeRecurringExpenseDTO` extends `TenantOrganizationBaseDTO`, which requires one of
// `organization` / `organizationId` / `sentTo`. We satisfy that with `sentTo` (a plain
// `@IsString()`) rather than `organizationId`, since `organizationId` also runs
// `@IsOrganizationBelongsToUser()` — an async validator that checks `RequestContext` and the
// database. There's no request or database in this suite, so that check would always fail here
// regardless of the employeeId behavior under test, which is the whole point of validating the
// DTO directly with no server involved.
const REQUIRED_FIELDS = {
	value: 250,
	categoryName: 'Travel',
	startDay: 1,
	startMonth: 1,
	startYear: 2026,
	startDate: new Date('2026-01-01'),
	currency: 'USD',
	sentTo: 'test-recipient'
};

type EmployeeRecurringExpenseDTOClass =
	| typeof CreateEmployeeRecurringExpenseDTO
	| typeof UpdateEmployeeRecurringExpenseDTO;

async function validatePayload(
	DTOClass: EmployeeRecurringExpenseDTOClass,
	payload: Record<string, unknown>
): Promise<{ dto: InstanceType<EmployeeRecurringExpenseDTOClass>; errors: ValidationError[] }> {
	const dto = plainToInstance(DTOClass, payload) as InstanceType<EmployeeRecurringExpenseDTOClass>;
	const errors = await validate(dto);

	return { dto, errors };
}

describe.each([
	['CreateEmployeeRecurringExpenseDTO', CreateEmployeeRecurringExpenseDTO],
	['UpdateEmployeeRecurringExpenseDTO', UpdateEmployeeRecurringExpenseDTO]
] as const)('%s', (_name, DTOClass) => {
	it('accepts an "All Employees" recurring expense (employeeId: null, no employee object)', async () => {
		const { errors } = await validatePayload(DTOClass, { ...REQUIRED_FIELDS, employeeId: null });

		expect(errors).toHaveLength(0);
	});

	it('accepts a recurring expense that omits employeeId entirely', async () => {
		const { errors } = await validatePayload(DTOClass, { ...REQUIRED_FIELDS });

		expect(errors).toHaveLength(0);
	});

	it('still accepts a recurring expense for a specific employee', async () => {
		const { errors, dto } = await validatePayload(DTOClass, {
			...REQUIRED_FIELDS,
			employeeId: VALID_EMPLOYEE_ID
		});

		expect(errors).toHaveLength(0);
		expect(dto.employeeId).toBe(VALID_EMPLOYEE_ID);
	});

	it('still rejects a malformed employeeId (control: proves employeeId is not just ignored)', async () => {
		const { errors } = await validatePayload(DTOClass, { ...REQUIRED_FIELDS, employeeId: 12345 });

		expect(errors.some((error) => error.property === 'employeeId')).toBe(true);
	});

	it('still rejects a payload missing the required expense fields (control: PartialType only relaxed employee/employeeId)', async () => {
		const { errors } = await validatePayload(DTOClass, { employeeId: null });

		expect(errors.some((error) => error.property === 'value')).toBe(true);
		expect(errors.some((error) => error.property === 'categoryName')).toBe(true);
	});
});
