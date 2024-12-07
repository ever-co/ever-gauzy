import { OrganizationRecurringExpenseDeleteHandler } from './organization-recurring-expense.delete.handler';
import { OrganizationRecurringExpenseEditHandler } from './organization-recurring-expense.edit.handler';
import { OrganizationRecurringExpenseCreateHandler } from './organization-recurring-expense.create.handler';

export const CommandHandlers = [
	OrganizationRecurringExpenseEditHandler,
	OrganizationRecurringExpenseDeleteHandler,
	OrganizationRecurringExpenseCreateHandler
];
