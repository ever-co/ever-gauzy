import { EmployeeRecurringExpenseDeleteHandler } from './employee-recurring-expense.delete.handler';
import { EmployeeRecurringExpenseEditHandler } from './employee-recurring-expense.edit.handler';
import { EmployeeRecurringExpenseCreateHandler } from './employee-recurring-expense.create.handler';

export const CommandHandlers = [
	EmployeeRecurringExpenseEditHandler,
	EmployeeRecurringExpenseDeleteHandler,
	EmployeeRecurringExpenseCreateHandler
];
