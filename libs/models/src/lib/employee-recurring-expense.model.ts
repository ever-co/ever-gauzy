import { BaseEntityModel as IBaseEntityModel } from './base-entity.model';
import { RecurringExpenseModel } from './recurring-expense.model';
import { Organization } from './organization.model';
import { ITenant } from './tenant.model';

export interface EmployeeRecurringExpense extends RecurringExpenseModel {
	employeeId: string;
  organization?: Organization;
  tenant: ITenant;
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
