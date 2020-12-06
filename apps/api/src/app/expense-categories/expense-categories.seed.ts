import { ExpenseCategoriesEnum, IOrganization } from '@gauzy/models';
import { Connection } from 'typeorm';
import { ExpenseCategory } from './expense-category.entity';
import { Tenant } from '../tenant/tenant.entity';

export const createExpenseCategories = async (
	connection: Connection,
	tenant: Tenant,
	organizations: IOrganization[]
): Promise<ExpenseCategory[]> => {
	let defaultExpenseCategories: ExpenseCategory[] = [];
	organizations.forEach((organization) => {
		const categories = Object.values(ExpenseCategoriesEnum).map((name) => {
			const category = new ExpenseCategory();
			category.name = name;
			category.organization = organization;
			category.tenant = tenant;
			return category;
		});
		defaultExpenseCategories = [...defaultExpenseCategories, ...categories];
	});

	return insertExpenseCategories(connection, defaultExpenseCategories);
};

export const createRandomExpenseCategories = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationMap: Map<Tenant, IOrganization[]>
): Promise<Map<IOrganization, ExpenseCategory[]>> => {
	let expenseCategories: ExpenseCategory[] = [];
	const expenseCategoryMap: Map<IOrganization, ExpenseCategory[]> = new Map();

	(tenants || []).forEach((tenant) => {
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
	});

	await insertExpenseCategories(connection, expenseCategories);
	return expenseCategoryMap;
};

const insertExpenseCategories = async (
	connection: Connection,
	expenseCategories: ExpenseCategory[]
): Promise<ExpenseCategory[]> => {
	return await connection.manager.save(expenseCategories);
};
