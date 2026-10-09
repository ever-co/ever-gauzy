import { IRecurringExpenseModel } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { PartialType } from "@nestjs/swagger";
import { EmployeeFeatureDTO } from "./../../employee/dto";
import { RelationalCurrencyDTO } from "./../../currency/dto";
import { EmployeeRecurringExpenseDTO } from "./employee-recurring-expense.dto";

export class CreateEmployeeRecurringExpenseDTO extends IntersectionType(
	EmployeeRecurringExpenseDTO,
	// `employee` / `employeeId` must stay OPTIONAL here, same as `CreateExpenseDTO` already wraps
	// `EmployeeFeatureDTO` in `PartialType`: the UI's "All Employees" option (`ga-employee-selector`
	// with `showAllEmployeesOption`) submits neither field (see
	// `RecurringExpensesEmployeeComponent._recurringExpenseMutationResultTransform`, which sends
	// `employeeId: null` and omits `employee` entirely for the ALL_EMPLOYEES_SELECTED sentinel).
	// Without `PartialType`, `EmployeeFeatureDTO`'s `@ValidateIf` pair forces `@IsObject()` on the
	// absent `employee` and `@IsString()` on the null `employeeId`, so both fail and every "All
	// Employees" recurring expense is rejected with an HTTP 400 (#8889) even though
	// `EmployeeBelongsToOrganizationConstraint` already tolerates an empty/null employee for this
	// exact org-level case.
	PartialType(EmployeeFeatureDTO),
	RelationalCurrencyDTO
	) implements IRecurringExpenseModel { }
