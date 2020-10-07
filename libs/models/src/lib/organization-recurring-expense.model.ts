import { IBasePerTenantAndOrganizationEntityModel } from './base-entity.model';
import { IRecurringExpenseModel } from './recurring-expense.model';

export interface IOrganizationRecurringExpense extends IRecurringExpenseModel {
	splitExpense: boolean;
}

export interface IOrganizationRecurringExpenseFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	month?: number;
	year?: number;
	categoryName?: string;
	value?: number;
	currency?: string;
	parentRecurringExpenseId?: string;
}

export interface IOrganizationRecurringExpenseByMonthFindInput
	extends IBasePerTenantAndOrganizationEntityModel {
	month?: number;
	year?: number;
}

export interface IOrganizationRecurringExpenseForEmployeeOutput {
	splitExpense: boolean;
	originalValue: number;
	employeeCount: number;
}
