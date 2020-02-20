import { OrganizationRecurringExpenseDeleteHandler } from './organization-recurring-expense.delete.handler';
import { OrganizationRecurringExpenseEditHandler } from './organization-recurring-expense.edit.handler';

export const CommandHandlers = [
	OrganizationRecurringExpenseEditHandler,
	OrganizationRecurringExpenseDeleteHandler
];
