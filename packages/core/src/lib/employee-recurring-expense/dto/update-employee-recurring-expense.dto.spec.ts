import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { UpdateEmployeeRecurringExpenseDTO } from './update-employee-recurring-expense.dto';

/**
 * `PUT /employee-recurring-expense/:id` runs `@UseValidationPipe({ transform: true })` against
 * `UpdateEmployeeRecurringExpenseDTO`, the same DTO that reaches `EmployeeRecurringExpenseEditCommand`
 * and, from there, `RecurringExpenseEditHandler`. It needs the same `employee` / `employeeId`
 * relaxation as `CreateEmployeeRecurringExpenseDTO` (see the sibling spec file) so that editing an
 * existing recurring expense to "All Employees" (`employeeId: null`, no `employee` object) passes
 * validation instead of failing with the same HTTP 400 (#8889) the create endpoint had.
 *
 * This only covers DTO validation. The edit handler's own bug — silently discarding that null and
 * keeping the previous employee — is covered separately in
 * `shared/handlers/recurring-expense.edit.handler.spec.ts`.
 */

const VALID_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000001';

// See create-employee-recurring-expense.dto.spec.ts: `sentTo` satisfies
// `TenantOrganizationBaseDTO` without pulling in the async, database-backed
// `IsOrganizationBelongsToUser()` check that `organizationId` would trigger.
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

async function validatePayload(
	payload: Record<string, unknown>
): Promise<{ dto: UpdateEmployeeRecurringExpenseDTO; errors: ValidationError[] }> {
	const dto = plainToInstance(UpdateEmployeeRecurringExpenseDTO, payload);
	const errors = await validate(dto);

	return { dto, errors };
}

describe('UpdateEmployeeRecurringExpenseDTO', () => {
	it('accepts switching an existing recurring expense to "All Employees" (employeeId: null, no employee object)', async () => {
		const { errors } = await validatePayload({
			...REQUIRED_FIELDS,
			employeeId: null
		});

		expect(errors).toHaveLength(0);
	});

	it('accepts an update that omits employeeId entirely (leaving the current assignment untouched)', async () => {
		const { errors } = await validatePayload({ ...REQUIRED_FIELDS });

		expect(errors).toHaveLength(0);
	});

	it('still accepts updating a recurring expense to a specific employee', async () => {
		const { errors, dto } = await validatePayload({
			...REQUIRED_FIELDS,
			employeeId: VALID_EMPLOYEE_ID
		});

		expect(errors).toHaveLength(0);
		expect(dto.employeeId).toBe(VALID_EMPLOYEE_ID);
	});

	it('still rejects a malformed employeeId (control: proves employeeId is not just ignored)', async () => {
		const { errors } = await validatePayload({
			...REQUIRED_FIELDS,
			employeeId: 12345
		});

		expect(errors.some((error) => error.property === 'employeeId')).toBe(true);
	});

	it('still rejects an update missing the required expense fields (control: PartialType only relaxed employee/employeeId)', async () => {
		const { errors } = await validatePayload({ employeeId: null });

		expect(errors.some((error) => error.property === 'value')).toBe(true);
		expect(errors.some((error) => error.property === 'categoryName')).toBe(true);
	});
});
