import { ExpenseCategoryCreateHandler } from "./expense-category-create.handler";
import { ExpenseCategoryFirstOrCreateHandler } from "./expense-category-first-or-create.handler";
import { ExpenseCategoryUpdateHandler } from "./expense-category-update.handler";

export const CommandHandlers = [
	ExpenseCategoryCreateHandler,
	ExpenseCategoryFirstOrCreateHandler,
	ExpenseCategoryUpdateHandler,
];
