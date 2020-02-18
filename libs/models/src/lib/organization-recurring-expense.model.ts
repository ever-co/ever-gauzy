import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RecurringExpenseDeletionEnum } from './employee-recurring-expense';
import { RecurringExpenseModel } from './recurring-expense.model';

export interface OrganizationRecurringExpense extends RecurringExpenseModel {
	orgId: string;
}

export interface OrganizationRecurringExpenseFindInput
	extends IBaseEntityModel {
	orgId?: string;
	month?: number;
	year?: number;
	categoryName?: string;
	value?: number;
	currency?: string;
}

/**
 * categoryName, value and currency are the new values.
 * startDay, startMonth, startYear represent the date when this was edited.
 */
export interface OrganizationRecurringExpenseEditInput
	extends IBaseEntityModel {
	startDay: number;
	startMonth: number;
	startYear: number;
	categoryName: string;
	value: number;
	currency: string;
}

export interface OrganizationRecurringExpenseByMonthFindInput
	extends IBaseEntityModel {
	orgId?: string;
	month?: number;
	year?: number;
}

export interface OrganizationRecurringExpenseDeleteInput {
	deletionType: RecurringExpenseDeletionEnum;
	month: number;
	year: number;
}
