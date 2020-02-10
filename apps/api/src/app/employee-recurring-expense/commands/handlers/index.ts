import { EmployeeRecurringExpenseDeleteHandler } from './employee-recurring-expense.delete.handler';
import { EmployeeRecurringExpenseEditHandler } from './employee-recurring-expense.edit.handler';

export const CommandHandlers = [
	EmployeeRecurringExpenseEditHandler,
	EmployeeRecurringExpenseDeleteHandler
];
