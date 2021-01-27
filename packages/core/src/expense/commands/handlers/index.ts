import { ExpenseCreateHandler } from './expense.create.handler';
import { ExpenseDeleteHandler } from './expense.delete.handler';
import { ExpenseUpdateHandler } from './expense.update.handler';

export const CommandHandlers = [
	ExpenseCreateHandler,
	ExpenseDeleteHandler,
	ExpenseUpdateHandler
];
