import { OrganizationRecurringExpenseByMonthHandler } from './organization-recurring-expense.by-month.handler';
import { OrganizationRecurringExpenseFindSplitExpenseHandler } from './organization-recurring-expense.find-split-expense.handler';
import { OrganizationRecurringExpenseUpdateTypeHandler } from './organization-recurring-expense.start-date-update-type.handler';

export const QueryHandlers = [
	OrganizationRecurringExpenseByMonthHandler,
	OrganizationRecurringExpenseFindSplitExpenseHandler,
	OrganizationRecurringExpenseUpdateTypeHandler
];
