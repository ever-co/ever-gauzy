import { ExpenseCategoriesEnum } from '@gauzy/models';
import { Connection } from 'typeorm';
import { ExpenseCategory } from './expense-category.entity';

const defaultExpenseCategories = [
	{ name: ExpenseCategoriesEnum.SOFTWARE },
	{ name: ExpenseCategoriesEnum.EMPLOYEES_BENEFITS },
	{ name: ExpenseCategoriesEnum.COURSES },
	{ name: ExpenseCategoriesEnum.SUBSCRIPTIONS },
	{ name: ExpenseCategoriesEnum.RENT },
	{ name: ExpenseCategoriesEnum.SERVICE_FEE }
];

export const createExpenseCategories = async (
	connection: Connection
): Promise<ExpenseCategory[]> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(ExpenseCategory)
		.values(defaultExpenseCategories)
		.execute();

	return defaultExpenseCategories;
};
