import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { CreateEmployeeRecurringExpenseDTO } from './create-employee-recurring-expense.dto';

// Reproduces #8889 from the DTO alone (no server/DB needed): the "All Employees" option sends
// { employeeId: null } with no employee key, which EmployeeFeatureDTO's ValidateIf pair used
// to reject with HTTP 400. See CreateEmployeeRecurringExpenseDTO for the root cause and fix.

const VALID_EMPLOYEE_ID = '00000000-0000-4000-8000-000000000001';

const REQUIRED_FIELDS = {
  value: 250,
  categoryName: 'Travel',
  startDay: 1,
  startMonth: 1,
  startYear: 2026,
  startDate: new Date('2026-01-01'),
  currency: 'USD'
};

async function validatePayload(
  payload: Record<string, unknown>
): Promise<{ dto: CreateEmployeeRecurringExpenseDTO; errors: ValidationError[] }> {
  const dto = plainToInstance(CreateEmployeeRecurringExpenseDTO, payload);
  const errors = await validate(dto);

  return { dto, errors };
}

describe('CreateEmployeeRecurringExpenseDTO', () => {
  it('accepts an "All Employees" recurring expense (employeeId: null, no employee object)', async () => {
    const { errors } = await validatePayload({
      ...REQUIRED_FIELDS,
      employeeId: null
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts an "All Employees" recurring expense when employeeId is omitted entirely', async () => {
    const { errors } = await validatePayload({ ...REQUIRED_FIELDS });

    expect(errors).toHaveLength(0);
  });

  it('still accepts a recurring expense for a specific employee', async () => {
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

  it('still rejects a request missing required fields (control: PartialType only relaxed employee/employeeId)', async () => {
    const { errors } = await validatePayload({ employeeId: null });

    expect(errors.some((error) => error.property === 'value')).toBe(true);
    expect(errors.some((error) => error.property === 'categoryName')).toBe(true);
  });
});
