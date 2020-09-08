import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RecurringExpenseModel } from './recurring-expense.model';

export interface EmployeeRecurringExpense extends RecurringExpenseModel {
	employeeId: string;
}

export interface EmployeeRecurringExpenseByMonthFindInput
	extends IBaseEntityModel {
	employeeId?: string;
	month?: number;
	year?: number;
}

export interface EmployeeRecurringExpenseFindInput {
	month?: number;
	year?: number;
	parentRecurringExpenseId?: string;
}
