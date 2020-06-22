import { ExpenseCategoriesEnum } from '@gauzy/models';
import { Connection } from 'typeorm';
import { ExpenseCategory } from './expense-category.entity';

const mapCategoryName = (name, organizationId) => ({ name, organizationId });
const defaultExpenseCategories = Object.values(ExpenseCategoriesEnum).map(
	mapCategoryName
);

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
