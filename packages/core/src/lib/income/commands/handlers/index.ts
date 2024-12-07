import { IncomeCreateHandler } from './income.create.handler';
import { IncomeDeleteHandler } from './income.delete.handler';
import { IncomeUpdateHandler } from './income.update.handler';

export const CommandHandlers = [
	IncomeCreateHandler,
	IncomeDeleteHandler,
	IncomeUpdateHandler
];
