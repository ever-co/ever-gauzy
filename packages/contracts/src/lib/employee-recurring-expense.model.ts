import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRecurringExpenseModel } from './recurring-expense.model';

export interface IEmployeeRecurringExpense extends IRecurringExpenseModel {
	/**
	 * Optional and nullable: an employee recurring expense created for "All Employees" has no
	 * specific employee attached. This matches the schema — `EmployeeRecurringExpense.employeeId`
	 * is a `nullable: true` relation id, and its `employee` relation is already optional — and the
	 * DTOs, which relax `employee` / `employeeId` via `PartialType(EmployeeFeatureDTO)` so that
	 * case validates instead of failing with an HTTP 400 (#8889).
	 */
	employeeId?: string | null;
}

export interface IEmployeeRecurringExpenseByMonthFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	startDate?: Date | string;
	endDate?: Date | string;
}

export interface IEmployeeRecurringExpenseFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	startDate?: Date;
	endDate?: Date;
	parentRecurringExpenseId?: string;
}
