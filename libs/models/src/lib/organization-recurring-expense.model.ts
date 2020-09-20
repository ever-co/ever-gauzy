import { IRecurringExpenseModel } from './recurring-expense.model';

export interface IOrganizationRecurringExpense extends IRecurringExpenseModel {
	splitExpense: boolean;
}

export interface IOrganizationRecurringExpenseFindInput {
	organizationId?: string;
	month?: number;
	year?: number;
	categoryName?: string;
	value?: number;
	currency?: string;
	parentRecurringExpenseId?: string;
}

export interface IOrganizationRecurringExpenseByMonthFindInput {
	organizationId?: string;
	month?: number;
	year?: number;
}

export interface IOrganizationRecurringExpenseForEmployeeOutput {
	splitExpense: boolean;
	originalValue: number;
	employeeCount: number;
}
