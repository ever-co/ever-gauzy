import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRecurringExpenseModel } from './recurring-expense.model';

export interface IEmployeeRecurringExpense extends IRecurringExpenseModel {
	employeeId: string;
}

export interface IEmployeeRecurringExpenseByMonthFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	employeeId?: string;
	month?: number;
	year?: number;
}

export interface IEmployeeRecurringExpenseFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	month?: number;
	year?: number;
	parentRecurringExpenseId?: string;
}
