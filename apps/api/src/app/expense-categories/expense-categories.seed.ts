import { ExpenseCategoriesEnum, Organization } from '@gauzy/models';
import { Connection } from 'typeorm';
import { ExpenseCategory } from './expense-category.entity';
import { Tenant } from '../tenant/tenant.entity';

export const createExpenseCategories = async (
	connection: Connection,
	organizations: Organization[]
): Promise<ExpenseCategory[]> => {
	let defaultExpenseCategories: ExpenseCategory[] = [];
	organizations.forEach((organization) => {
		const category = Object.values(ExpenseCategoriesEnum).map((name) => ({
			name,
			organizationId: organization.id
		}));
		defaultExpenseCategories = [...defaultExpenseCategories, ...category];
	});

	insertExpenseCategories(connection, defaultExpenseCategories);

	return defaultExpenseCategories;
};

export const createRandomExpenseCategories = async (
	connection: Connection,
	tenants: Tenant[],
	tenantOrganizationMap: Map<Tenant, Organization[]>
): Promise<Map<Organization, ExpenseCategory[]>> => {
	let expenseCategories: ExpenseCategory[] = [];
	const expenseCategoryMap: Map<Organization, ExpenseCategory[]> = new Map();

	(tenants || []).forEach((tenant) => {
		const organizations = tenantOrganizationMap.get(tenant);
		(organizations || []).forEach((organization) => {
			const category = Object.values(ExpenseCategoriesEnum).map(
				(name) => ({
					name,
					organizationId: organization.id
				})
			);
			expenseCategoryMap.set(organization, category);
			expenseCategories = [...expenseCategories, ...category];
		});
	});

	await insertExpenseCategories(connection, expenseCategories);
	return expenseCategoryMap;
};

const insertExpenseCategories = async (
	connection: Connection,
	expenseCategory: ExpenseCategory[]
) => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(ExpenseCategory)
		.values(expenseCategory)
		.execute();
};
