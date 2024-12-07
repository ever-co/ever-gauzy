import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRecurringExpenseModel } from './recurring-expense.model';

export interface IEmployeeRecurringExpense extends IRecurringExpenseModel {
	employeeId: string;
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
