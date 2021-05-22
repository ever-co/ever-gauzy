import { ExpenseCategoriesEnum, IExpenseCategory, IOrganization, ITenant } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import { ExpenseCategory } from './expense-category.entity';

export const createExpenseCategories = async (
	connection: Connection,
	tenant: ITenant,
	organizations: IOrganization[]
): Promise<ExpenseCategory[]> => {
	let defaultExpenseCategories: ExpenseCategory[] = [];
	for (const organization of organizations) {
		const categories = Object.values(ExpenseCategoriesEnum).map((name) => {
			const category = new ExpenseCategory();
			category.name = name;
			category.organization = organization;
			category.tenant = tenant;
			return category;
		});
		defaultExpenseCategories = [...defaultExpenseCategories, ...categories];
	}
	return insertExpenseCategories(connection, defaultExpenseCategories);
};

export const createRandomExpenseCategories = async (
	connection: Connection,
	tenants: ITenant[],
	tenantOrganizationMap: Map<ITenant, IOrganization[]>
): Promise<Map<IOrganization, IExpenseCategory[]>> => {
	let expenseCategories: ExpenseCategory[] = [];
	const expenseCategoryMap: Map<IOrganization, IExpenseCategory[]> = new Map();
	for (const tenant of tenants) {
		const organizations = tenantOrganizationMap.get(tenant);
		(organizations || []).forEach((organization) => {
			const categories = Object.values(ExpenseCategoriesEnum).map(
				(name) => {
					const category = new ExpenseCategory();
					category.name = name;
					category.organization = organization;
					category.tenant = tenant;
					return category;
				}
			);
			expenseCategoryMap.set(organization, categories);
			expenseCategories = [...expenseCategories, ...categories];
		});
	}
	await insertExpenseCategories(connection, expenseCategories);
	return expenseCategoryMap;
};

const insertExpenseCategories = async (
	connection: Connection,
	expenseCategories: ExpenseCategory[]
): Promise<ExpenseCategory[]> => {
	return await connection.manager.save(expenseCategories);
};
